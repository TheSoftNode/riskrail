;; Example: consuming RiskRail from another Stacks contract.
;;
;; This is reference material, not part of the RiskRail protocol. It exists so
;; that "an external application can consume RiskRail without knowing our
;; storage internals" is a thing the test suite proves rather than a thing the
;; README asserts.
;;
;; It stands in for the shape a lending product, yield router or autonomous
;; agent would use: before letting a user take on more risk, ask RiskRail
;; whether the wallet currently looks safe across *all* protocols -- not just
;; the one this contract happens to know about.
;;
;; Note what it does not do. It never reads a RiskRail map, never hardcodes the
;; registry address, and never learns how snapshots are stored. It talks to a
;; `<risk-provider>` passed in by the caller, so the same code works against a
;; test double, a future registry version, or any other conforming provider.

(use-trait risk-provider .risk-provider-trait.risk-provider-trait)

(define-constant ERR_NO_FRESH_RISK (err u400))
(define-constant ERR_UNHEALTHY (err u401))
(define-constant ERR_TOO_CONCENTRATED (err u402))

;; Roughly a day of Stacks blocks. A reading older than this is refused outright
;; rather than used, which is the whole point of `get-risk-if-fresh`.
(define-constant MAX_RISK_AGE_BLOCKS u144)
(define-constant MIN_HEALTH_FACTOR_E4 u12500)   ;; 1.25
(define-constant MAX_CONCENTRATION_BPS u6000)   ;; 60%

(define-data-var approvals uint u0)
(define-map last-approved-at principal uint)

;; The guardrail an integrator would put in front of a risky action.
(define-public (open-position (provider <risk-provider>) (user principal))
  (let (
    (risk (unwrap!
            (try! (contract-call? provider get-risk-if-fresh user MAX_RISK_AGE_BLOCKS))
            ERR_NO_FRESH_RISK))
  )
    (asserts! (>= (get health-factor-e4 risk) MIN_HEALTH_FACTOR_E4) ERR_UNHEALTHY)
    (asserts! (<= (get protocol-concentration-bps risk) MAX_CONCENTRATION_BPS) ERR_TOO_CONCENTRATED)
    (var-set approvals (+ (var-get approvals) u1))
    (map-set last-approved-at user stacks-block-height)
    (print {
      event: "position-opened",
      user: user,
      health-factor-e4: (get health-factor-e4 risk),
      ;; Recording the digest means this decision can be audited later against
      ;; the exact report it was made from.
      report-hash: (get report-hash risk)
    })
    (ok (get snapshot-id risk))
  )
)

;; Clarity will not let a `define-read-only` function dispatch on a trait: the
;; analyzer cannot prove a dynamically resolved callee is itself read-only, so
;; the whole function is treated as writing. Integrators hit this as soon as
;; they try to build a "would this be allowed?" preview.
;;
;; The way around it is to split the two halves. RiskRail's own
;; `get-risk-if-fresh` *is* read-only, so a UI or another read-only function can
;; call the registry directly and then apply its thresholds with a pure helper
;; like this one, which needs no contract call at all.
(define-read-only (meets-policy (health-factor-e4 uint) (protocol-concentration-bps uint))
  (and (>= health-factor-e4 MIN_HEALTH_FACTOR_E4)
       (<= protocol-concentration-bps MAX_CONCENTRATION_BPS))
)

(define-read-only (get-approvals)
  (var-get approvals)
)

(define-read-only (get-last-approved-at (user principal))
  (map-get? last-approved-at user)
)
