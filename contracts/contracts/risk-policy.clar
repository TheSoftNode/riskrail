(define-constant ERR_INVALID_SCORE (err u200))
(define-constant ERR_INVALID_BPS (err u201))

(define-map risk-policies
  principal
  {
    max-risk-score-bps: uint,
    min-health-factor-e4: uint,
    max-protocol-concentration-bps: uint,
    min-liquidity-score-bps: uint,
    enabled: bool,
    updated-at: uint
  }
)

(define-public (set-risk-policy
  (max-risk-score-bps uint)
  (min-health-factor-e4 uint)
  (max-protocol-concentration-bps uint)
  (min-liquidity-score-bps uint))
  (begin
    (asserts! (<= max-risk-score-bps u10000) ERR_INVALID_SCORE)
    (asserts! (<= max-protocol-concentration-bps u10000) ERR_INVALID_BPS)
    (asserts! (<= min-liquidity-score-bps u10000) ERR_INVALID_BPS)
    (map-set risk-policies tx-sender {
      max-risk-score-bps: max-risk-score-bps,
      min-health-factor-e4: min-health-factor-e4,
      max-protocol-concentration-bps: max-protocol-concentration-bps,
      min-liquidity-score-bps: min-liquidity-score-bps,
      enabled: true,
      updated-at: stacks-block-height
    })
    (print { event: "risk-policy-updated", wallet: tx-sender })
    (ok true)
  )
)

(define-public (set-policy-enabled (enabled bool))
  (match (map-get? risk-policies tx-sender)
    policy
      (begin
        (map-set risk-policies tx-sender (merge policy { enabled: enabled, updated-at: stacks-block-height }))
        (print { event: "risk-policy-enabled", wallet: tx-sender, enabled: enabled })
        (ok true))
    (ok false))
)

(define-read-only (get-risk-policy (wallet principal))
  (map-get? risk-policies wallet)
)
