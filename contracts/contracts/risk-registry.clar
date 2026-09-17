(impl-trait .risk-provider-trait.risk-provider-trait)

(define-constant ERR_UNAUTHORIZED (err u100))
(define-constant ERR_INVALID_SCORE (err u101))
(define-constant ERR_INVALID_BPS (err u102))
(define-constant ERR_INVALID_SOURCE_BLOCK (err u103))

(define-data-var contract-owner principal tx-sender)

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

(define-public (set-publisher (publisher principal) (enabled bool))
  (begin
    (asserts! (is-owner) ERR_UNAUTHORIZED)
    (map-set authorized-publishers publisher enabled)
    (print { event: "publisher-updated", publisher: publisher, enabled: enabled })
    (ok true)
  )
)

(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-owner) ERR_UNAUTHORIZED)
    (var-set contract-owner new-owner)
    (print { event: "ownership-transferred", new-owner: new-owner })
    (ok true)
  )
)

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
    (asserts! (<= liquidation-distance-bps u10000) ERR_INVALID_BPS)
    (asserts! (<= protocol-concentration-bps u10000) ERR_INVALID_BPS)
    (asserts! (<= liquidity-score-bps u10000) ERR_INVALID_BPS)
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

(define-read-only (get-latest-risk-score (wallet principal))
  (ok (match (get-latest-snapshot wallet)
    snapshot (some (get risk-score-bps snapshot))
    none))
)

(define-read-only (get-latest-report-hash (wallet principal))
  (ok (match (get-latest-snapshot wallet)
    snapshot (some (get report-hash snapshot))
    none))
)

(define-read-only (is-snapshot-fresh (wallet principal) (max-age-blocks uint))
  (match (get-latest-snapshot wallet)
    snapshot
      (let ((published-at (get published-at snapshot)))
        (and (>= stacks-block-height published-at)
             (<= (- stacks-block-height published-at) max-age-blocks)))
    false)
)

(define-read-only (is-authorized-publisher (publisher principal))
  (or (is-eq publisher (var-get contract-owner))
      (default-to false (map-get? authorized-publishers publisher)))
)
