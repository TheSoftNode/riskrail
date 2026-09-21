(define-constant ERR_INVALID_SCORE (err u200))
(define-constant ERR_INVALID_BPS (err u201))
(define-constant ERR_INVALID_HEALTH_FACTOR (err u202))

;; 100.00 as an e4 fixed-point value. A minimum health factor above this is not
;; a guardrail, it is a position that can never satisfy the policy -- every
;; snapshot would breach and the alert would be pure noise. The three bps fields
;; were bounded from the start; this one was not.
(define-constant MAX_MIN_HEALTH_FACTOR_E4 u1000000)

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

;; The checker cannot see that the asserts above gate this write, so it treats
;; every caller-supplied value as tainted. Annotated deliberately.
;; #[allow(unchecked_data)]
(define-public (set-risk-policy
  (max-risk-score-bps uint)
  (min-health-factor-e4 uint)
  (max-protocol-concentration-bps uint)
  (min-liquidity-score-bps uint))
  (begin
    (asserts! (<= max-risk-score-bps u10000) ERR_INVALID_SCORE)
    (asserts! (<= max-protocol-concentration-bps u10000) ERR_INVALID_BPS)
    (asserts! (<= min-liquidity-score-bps u10000) ERR_INVALID_BPS)
    (asserts! (<= min-health-factor-e4 MAX_MIN_HEALTH_FACTOR_E4) ERR_INVALID_HEALTH_FACTOR)
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

;; The checker cannot see that the asserts above gate this write, so it treats
;; every caller-supplied value as tainted. Annotated deliberately.
;; #[allow(unchecked_data)]
(define-public (set-policy-enabled (enabled bool))
  (match (map-get? risk-policies tx-sender)
    policy
      (begin
        (map-set risk-policies tx-sender (merge policy { enabled: enabled, updated-at: stacks-block-height }))
        (print { event: "risk-policy-enabled", wallet: tx-sender, enabled: enabled })
        (ok true))
    (ok false))
)

;; Removing a policy entirely, rather than only disabling it. A wallet that
;; never wants RiskRail evaluating it on chain should be able to leave no trace,
;; not just an `enabled: false` row.
(define-public (delete-risk-policy)
  (begin
    (map-delete risk-policies tx-sender)
    (print { event: "risk-policy-deleted", wallet: tx-sender })
    (ok true)
  )
)

(define-read-only (get-max-min-health-factor)
  MAX_MIN_HEALTH_FACTOR_E4
)

(define-read-only (get-risk-policy (wallet principal))
  (map-get? risk-policies wallet)
)
