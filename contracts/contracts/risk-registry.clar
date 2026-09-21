;; RiskRail risk registry -- append-only risk attestations for Stacks wallets.
;;
;; RiskRail computes risk off-chain and publishes a compact, verifiable summary
;; here. This contract is the on-chain half of that: it stores what another
;; contract can act on, plus the SHA-256 of the full canonical report so anyone
;; can re-hash the JSON and prove it was not edited afterwards.
;;
;; The full report is deliberately NOT stored on chain. Storing a digest keeps
;; the contract small and auditable while losing nothing that matters -- the
;; report itself is served by the API and verified against this hash.
;;
;; Snapshots are append-only. Publishing never overwrites a previous snapshot,
;; so historical attestations stay verifiable even after a wallet's risk moves
;; or a publisher is revoked.
;;
;; See `traits/risk-provider-trait.clar` for units and, importantly, for why the
;; no-debt sentinels are what they are.

(impl-trait .risk-provider-trait.risk-provider-trait)

(define-constant ERR_UNAUTHORIZED (err u100))
(define-constant ERR_INVALID_SCORE (err u101))
(define-constant ERR_INVALID_BPS (err u102))
(define-constant ERR_INVALID_SOURCE_BLOCK (err u103))

;; A wallet with no debt has no meaningful health factor. It is published as the
;; maximum uint rather than zero so that a consumer's natural safety check,
;; `(>= health-factor threshold)`, treats a debt-free wallet as safe. Zero would
;; invert that check and read "no debt" as "about to be liquidated".
(define-constant HEALTH_FACTOR_UNBOUNDED u340282366920938463463374607431768211455)

;; Same idea: furthest possible distance from liquidation, used when there is no
;; debt to be liquidated.
(define-constant LIQUIDATION_DISTANCE_MAX u10000)

(define-data-var contract-owner principal tx-sender)
;; Ownership moves in two steps. A single-step transfer to a mistyped or
;; unreachable principal permanently removes the ability to authorise or revoke
;; publishers, and there is no recovery from that.
(define-data-var pending-owner (optional principal) none)

(define-map authorized-publishers principal bool)
(define-map latest-snapshot-id principal uint)

(define-map risk-snapshots
  { wallet: principal, id: uint }
  {
    risk-score-bps: uint,
    health-factor-e4: uint,
    liquidation-distance-bps: uint,
    protocol-concentration-bps: uint,
    liquidity-score-bps: uint,
    source-block: uint,
    report-hash: (buff 32),
    published-at: uint
  }
)

(define-private (is-owner)
  (is-eq tx-sender (var-get contract-owner))
)

(define-private (is-publisher)
  (or (is-owner) (default-to false (map-get? authorized-publishers tx-sender)))
)

(define-private (is-fresh (published-at uint) (max-age-blocks uint))
  (and (>= stacks-block-height published-at)
       (<= (- stacks-block-height published-at) max-age-blocks))
)

;; --- administration --------------------------------------------------------

;; The checker cannot see that the asserts above gate this write, so it treats
;; every caller-supplied value as tainted. Annotated deliberately.
;; #[allow(unchecked_data)]
(define-public (set-publisher (publisher principal) (enabled bool))
  (begin
    (asserts! (is-owner) ERR_UNAUTHORIZED)
    (map-set authorized-publishers publisher enabled)
    (print { event: "publisher-updated", publisher: publisher, enabled: enabled })
    (ok true)
  )
)

;; Step 1: the current owner nominates a successor. Nothing changes yet.
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

;; Step 2: the successor proves it can transact by claiming the role itself.
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

;; --- publishing ------------------------------------------------------------

;; The checker cannot see that the asserts above gate this write, so it treats
;; every caller-supplied value as tainted. Annotated deliberately.
;; #[allow(unchecked_data)]
(define-public (publish-risk-snapshot
  (wallet principal)
  (risk-score-bps uint)
  (health-factor-e4 uint)
  (liquidation-distance-bps uint)
  (protocol-concentration-bps uint)
  (liquidity-score-bps uint)
  (source-block uint)
  (report-hash (buff 32)))
  (let (
    (current-id (default-to u0 (map-get? latest-snapshot-id wallet)))
    (next-id (+ current-id u1))
  )
    (asserts! (is-publisher) ERR_UNAUTHORIZED)
    (asserts! (<= risk-score-bps u10000) ERR_INVALID_SCORE)
    (asserts! (<= liquidation-distance-bps LIQUIDATION_DISTANCE_MAX) ERR_INVALID_BPS)
    (asserts! (<= protocol-concentration-bps u10000) ERR_INVALID_BPS)
    (asserts! (<= liquidity-score-bps u10000) ERR_INVALID_BPS)
    ;; A snapshot may not claim to describe chain state that has not happened.
    (asserts! (<= source-block stacks-block-height) ERR_INVALID_SOURCE_BLOCK)
    (map-set risk-snapshots
      { wallet: wallet, id: next-id }
      {
        risk-score-bps: risk-score-bps,
        health-factor-e4: health-factor-e4,
        liquidation-distance-bps: liquidation-distance-bps,
        protocol-concentration-bps: protocol-concentration-bps,
        liquidity-score-bps: liquidity-score-bps,
        source-block: source-block,
        report-hash: report-hash,
        published-at: stacks-block-height
      })
    (map-set latest-snapshot-id wallet next-id)
    (print {
      event: "risk-snapshot-published",
      wallet: wallet,
      snapshot-id: next-id,
      risk-score-bps: risk-score-bps,
      source-block: source-block,
      report-hash: report-hash
    })
    (ok next-id)
  )
)

;; --- storage-level reads ---------------------------------------------------

(define-read-only (get-snapshot (wallet principal) (id uint))
  (map-get? risk-snapshots { wallet: wallet, id: id })
)

(define-read-only (get-latest-snapshot-id (wallet principal))
  (map-get? latest-snapshot-id wallet)
)

(define-read-only (get-latest-snapshot (wallet principal))
  (match (map-get? latest-snapshot-id wallet)
    id (map-get? risk-snapshots { wallet: wallet, id: id })
    none)
)

(define-read-only (is-authorized-publisher (publisher principal))
  (or (is-eq publisher (var-get contract-owner))
      (default-to false (map-get? authorized-publishers publisher)))
)

;; Exposed so an integrator can compare against the sentinel by name rather
;; than pasting a 39-digit literal into their own contract.
(define-read-only (get-unbounded-health-factor)
  HEALTH_FACTOR_UNBOUNDED
)

;; The value a debt-free wallet publishes for liquidation distance. Exposed for
;; the same reason as the health-factor sentinel: so an integrator compares
;; against a named value rather than a literal they have to trust.
(define-read-only (get-max-liquidation-distance)
  LIQUIDATION_DISTANCE_MAX
)

(define-read-only (get-owner)
  (var-get contract-owner)
)

(define-read-only (get-pending-owner)
  (var-get pending-owner)
)

;; --- trait: compact reads --------------------------------------------------

(define-read-only (get-latest-risk (wallet principal))
  (ok (match (map-get? latest-snapshot-id wallet)
    id (match (map-get? risk-snapshots { wallet: wallet, id: id })
         snapshot (some (merge snapshot { snapshot-id: id }))
         none)
    none))
)

;; Returns `none` for a stale reading rather than a number the caller might act
;; on. This is the read a protocol should build a decision from: the freshness
;; check cannot be skipped, because there is no way to get the value without it.
(define-read-only (get-risk-if-fresh (wallet principal) (max-age-blocks uint))
  (ok (match (map-get? latest-snapshot-id wallet)
    id (match (map-get? risk-snapshots { wallet: wallet, id: id })
         snapshot (if (is-fresh (get published-at snapshot) max-age-blocks)
                    (some (merge snapshot { snapshot-id: id }))
                    none)
         none)
    none))
)

(define-read-only (is-snapshot-fresh (wallet principal) (max-age-blocks uint))
  (ok (match (get-latest-snapshot wallet)
    snapshot (is-fresh (get published-at snapshot) max-age-blocks)
    false))
)

;; --- trait: single-field reads ---------------------------------------------

(define-read-only (get-latest-risk-score (wallet principal))
  (ok (match (get-latest-snapshot wallet)
    snapshot (some (get risk-score-bps snapshot))
    none))
)

(define-read-only (get-latest-health-factor (wallet principal))
  (ok (match (get-latest-snapshot wallet)
    snapshot (some (get health-factor-e4 snapshot))
    none))
)

(define-read-only (get-latest-liquidation-distance (wallet principal))
  (ok (match (get-latest-snapshot wallet)
    snapshot (some (get liquidation-distance-bps snapshot))
    none))
)

(define-read-only (get-latest-protocol-concentration (wallet principal))
  (ok (match (get-latest-snapshot wallet)
    snapshot (some (get protocol-concentration-bps snapshot))
    none))
)

(define-read-only (get-latest-liquidity-score (wallet principal))
  (ok (match (get-latest-snapshot wallet)
    snapshot (some (get liquidity-score-bps snapshot))
    none))
)

(define-read-only (get-latest-source-block (wallet principal))
  (ok (match (get-latest-snapshot wallet)
    snapshot (some (get source-block snapshot))
    none))
)

(define-read-only (get-latest-report-hash (wallet principal))
  (ok (match (get-latest-snapshot wallet)
    snapshot (some (get report-hash snapshot))
    none))
)
