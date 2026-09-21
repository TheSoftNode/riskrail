;; RiskRail protocol registry -- the canonical list of protocols RiskRail knows
;; how to interpret.
;;
;; Read this entry exactly as it is meant:
;;
;;   "RiskRail ships a supported adapter for this protocol, at this version."
;;
;; It does NOT mean the protocol has partnered with, endorsed, reviewed or even
;; heard of RiskRail. Anyone building on this registry, or writing copy about
;; it, should keep that distinction -- claiming endorsement we do not have costs
;; more credibility than the registry is worth.
;;
;; `metadata-hash` pins the adapter's descriptor so a consumer can tell whether
;; the interpretation of a protocol changed between two risk snapshots.
;;
;; Disabling a protocol clears `enabled` but never deletes the entry, so risk
;; attestations published while an older adapter was live stay explicable.

(define-constant ERR_UNAUTHORIZED (err u300))
(define-constant ERR_ALREADY_EXISTS (err u301))
(define-constant ERR_NOT_FOUND (err u302))

(define-data-var contract-owner principal tx-sender)
;; Two-step, for the same reason as the risk registry: this contract had no
;; transfer function at all, so a lost or rotated deployer key would have frozen
;; the adapter list permanently.
(define-data-var pending-owner (optional principal) none)

(define-map protocols
  uint
  {
    name: (string-ascii 64),
    protocol-type: (string-ascii 32),
    contract-principal: principal,
    adapter-version: uint,
    metadata-hash: (buff 32),
    enabled: bool,
    updated-at: uint
  }
)

(define-private (is-owner)
  (is-eq tx-sender (var-get contract-owner))
)

;; The checker cannot see that the asserts above gate this write, so it treats
;; every caller-supplied value as tainted. Annotated deliberately.
;; #[allow(unchecked_data)]
(define-public (register-protocol
  (protocol-id uint)
  (name (string-ascii 64))
  (protocol-type (string-ascii 32))
  (contract-principal principal)
  (adapter-version uint)
  (metadata-hash (buff 32)))
  (begin
    (asserts! (is-owner) ERR_UNAUTHORIZED)
    (asserts! (is-none (map-get? protocols protocol-id)) ERR_ALREADY_EXISTS)
    (map-set protocols protocol-id {
      name: name,
      protocol-type: protocol-type,
      contract-principal: contract-principal,
      adapter-version: adapter-version,
      metadata-hash: metadata-hash,
      enabled: true,
      updated-at: stacks-block-height
    })
    (print { event: "protocol-registered", protocol-id: protocol-id, contract-principal: contract-principal })
    (ok true)
  )
)

;; The checker cannot see that the asserts above gate this write, so it treats
;; every caller-supplied value as tainted. Annotated deliberately.
;; #[allow(unchecked_data)]
(define-public (set-protocol-enabled (protocol-id uint) (enabled bool))
  (begin
    (asserts! (is-owner) ERR_UNAUTHORIZED)
    (match (map-get? protocols protocol-id)
      protocol
        (begin
          (map-set protocols protocol-id (merge protocol { enabled: enabled, updated-at: stacks-block-height }))
          (print { event: "protocol-enabled", protocol-id: protocol-id, enabled: enabled })
          (ok true))
      ERR_NOT_FOUND)
  )
)

;; The checker cannot see that the asserts above gate this write, so it treats
;; every caller-supplied value as tainted. Annotated deliberately.
;; #[allow(unchecked_data)]
(define-public (set-adapter-version (protocol-id uint) (adapter-version uint) (metadata-hash (buff 32)))
  (begin
    (asserts! (is-owner) ERR_UNAUTHORIZED)
    (match (map-get? protocols protocol-id)
      protocol
        (begin
          (map-set protocols protocol-id (merge protocol {
            adapter-version: adapter-version,
            metadata-hash: metadata-hash,
            updated-at: stacks-block-height
          }))
          (print { event: "protocol-adapter-updated", protocol-id: protocol-id, adapter-version: adapter-version })
          (ok true))
      ERR_NOT_FOUND)
  )
)

;; Owner-gated by the assert; the checker cannot see that.
;; #[allow(unchecked_data)]
(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-owner) ERR_UNAUTHORIZED)
    (var-set pending-owner (some new-owner))
    (print { event: "ownership-transfer-started", to: new-owner })
    (ok true)
  )
)

(define-public (accept-ownership)
  (begin
    (asserts! (is-eq (some tx-sender) (var-get pending-owner)) ERR_UNAUTHORIZED)
    (var-set contract-owner tx-sender)
    (var-set pending-owner none)
    (print { event: "ownership-transferred", new-owner: tx-sender })
    (ok true)
  )
)

(define-public (cancel-ownership-transfer)
  (begin
    (asserts! (is-owner) ERR_UNAUTHORIZED)
    (var-set pending-owner none)
    (print { event: "ownership-transfer-cancelled", by: tx-sender })
    (ok true)
  )
)

(define-read-only (get-owner)
  (var-get contract-owner)
)

(define-read-only (get-pending-owner)
  (var-get pending-owner)
)

(define-read-only (get-protocol (protocol-id uint))
  (map-get? protocols protocol-id)
)

(define-read-only (is-supported-protocol (protocol-id uint))
  (match (map-get? protocols protocol-id)
    protocol (get enabled protocol)
    false)
)
