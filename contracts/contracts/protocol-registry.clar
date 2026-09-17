(define-constant ERR_UNAUTHORIZED (err u300))
(define-constant ERR_ALREADY_EXISTS (err u301))
(define-constant ERR_NOT_FOUND (err u302))

(define-data-var contract-owner principal tx-sender)

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

(define-read-only (get-protocol (protocol-id uint))
  (map-get? protocols protocol-id)
)

(define-read-only (is-supported-protocol (protocol-id uint))
  (match (map-get? protocols protocol-id)
    protocol (get enabled protocol)
    false)
)
