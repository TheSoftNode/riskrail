;; RiskRail risk provider -- the stable on-chain interface.
;;
;; This trait is what external Stacks applications integrate against. It is
;; deliberately a *small trusted core*: the REST API and SDK return far richer
;; data, while this returns the handful of values another contract can act on
;; without trusting, or understanding, RiskRail's storage.
;;
;; A trait cannot be changed once deployed. Extending it later means publishing
;; a second trait and asking every integrator to migrate, so the surface here is
;; meant to be the one we keep.
;;
;; ---------------------------------------------------------------------------
;; Reading these values safely
;; ---------------------------------------------------------------------------
;;
;; Two rules matter more than anything else in this file.
;;
;; 1. A risk reading has an age. `get-latest-*` will happily return a number
;;    published hundreds of blocks ago, taken from chain state older still.
;;    Consumers making a financial decision should use `get-risk-if-fresh`,
;;    which returns `none` rather than a stale reading, so the check cannot be
;;    forgotten.
;;
;; 2. Sentinels are chosen so the naive comparison is the safe one. A wallet
;;    with no debt has no meaningful health factor; it publishes the maximum
;;    uint, not zero. A consumer writing `(>= health-factor threshold)` then
;;    treats a debt-free wallet as safe, which is correct. Had it been zero,
;;    the same expression would read "debt free" as "about to be liquidated".
;;    Likewise `liquidation-distance-bps` is u10000 (100% away) when there is
;;    no debt.
;;
;; Units, fixed-point and unsigned throughout:
;;   risk-score-bps               0..10000    (10000 = maximum risk)
;;   health-factor-e4             1.47 -> u14700; max uint = no debt
;;   liquidation-distance-bps     0..10000    (10000 = no debt / furthest)
;;   protocol-concentration-bps   0..10000    (largest single-protocol share)
;;   liquidity-score-bps          0..10000    (10000 = most accessible)
;;   source-block                 Stacks block the underlying state was read at
;;   published-at                 Stacks block the attestation was written at
;;   report-hash                  SHA-256 of the canonical JSON risk report

(define-trait risk-provider-trait
  (
    ;; --- compact reads: prefer these -------------------------------------
    ;; Everything from one snapshot in a single call.
    (get-latest-risk
      (principal)
      (response (optional {
        snapshot-id: uint,
        risk-score-bps: uint,
        health-factor-e4: uint,
        liquidation-distance-bps: uint,
        protocol-concentration-bps: uint,
        liquidity-score-bps: uint,
        source-block: uint,
        report-hash: (buff 32),
        published-at: uint
      }) uint))

    ;; As above, but `none` when the newest snapshot is older than
    ;; `max-age-blocks`. This is the function to build a decision on.
    (get-risk-if-fresh
      (principal uint)
      (response (optional {
        snapshot-id: uint,
        risk-score-bps: uint,
        health-factor-e4: uint,
        liquidation-distance-bps: uint,
        protocol-concentration-bps: uint,
        liquidity-score-bps: uint,
        source-block: uint,
        report-hash: (buff 32),
        published-at: uint
      }) uint))

    (is-snapshot-fresh (principal uint) (response bool uint))

    ;; --- single-field reads ----------------------------------------------
    ;; Cheaper when a consumer needs exactly one number, but they carry no
    ;; freshness information. `none` means "no snapshot for this wallet".
    (get-latest-risk-score (principal) (response (optional uint) uint))
    (get-latest-health-factor (principal) (response (optional uint) uint))
    (get-latest-liquidation-distance (principal) (response (optional uint) uint))
    (get-latest-protocol-concentration (principal) (response (optional uint) uint))
    (get-latest-liquidity-score (principal) (response (optional uint) uint))
    (get-latest-source-block (principal) (response (optional uint) uint))
    (get-latest-report-hash (principal) (response (optional (buff 32)) uint))
  )
)
