;; Minimal composability interface. Consumers can query the latest score/hash
;; without depending on RiskRail's full storage model.
(define-trait risk-provider-trait
  (
    (get-latest-risk-score (principal) (response (optional uint) uint))
    (get-latest-report-hash (principal) (response (optional (buff 32)) uint))
  )
)
