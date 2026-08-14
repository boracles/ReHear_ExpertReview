/**
 * Only SHA-256 token hashes are published. Raw invitation links live in the
 * ignored local participant-links file and are never committed.
 */
export const INVITE_HASHES: Readonly<Record<string, string>> = {
  "mfLHIxtGJwJ-XvHvL_xGCSsCcmcj2CEPhxVz-bc3SmY": "EXP-01",
  "dKJ5ZBNR9fDCtOzcHY_vXil2o1Nq-LViG4QsIurccY4": "EXP-02",
  "fu8wrNMUOJnwUBpgoN0OxltJ7Aj9Cwu8MvyMtE-lbzA": "EXP-03",
  "cW4rFGtd4UIsYRWVzelfyqGq1P7FzxF65P8Nwenoklg": "EXP-04",
  "gUC4tcmBy1ESk3vMLYN-aRkc8aPpRPj-VRWvv2UAW_c": "EXP-05",
  "GikFMbYTD4JrdRJdG1ppCTnegdm2N2wWL4ySkmlv-ig": "EXP-06",
  "2G3bjXgEXoDk5RfKyryQkNy1ESDxzrYuls4sxS8FKwU": "TEST-01",
};

/**
 * Review links are issued only after the approved study explanation and
 * consent process has been completed. Raw review tokens are kept locally.
 */
export const REVIEW_HASHES: Readonly<Record<string, string>> = {
  "sMZ4az942dq8bTv9SXgp1eLpqEZIbMNZ38sA89ecWSg": "EXP-01",
  "lPa6iXOWxUJ5Lf8_1jNix098qc66bQIc7pEF7rRotm4": "EXP-02",
  "UrApT_H2SUKNIJazdIqCFipx9GnAh1TzOob9r3mRoIQ": "EXP-03",
  "pKXw6vo826bDjrcmfEy-yN2IrxYDcDtyAKd2Cyh13fI": "EXP-04",
  "rIAosnhX9xbi6sAJX8eYNRqblVakL0W9v5PR828ZkD0": "EXP-05",
  "am3m5yJYjshs6f7_4pXY5_riCT747GsGbalsBiDAsw0": "EXP-06",
  "ijjJyCwX5tPOBYOFDhOtSZpyrXSax9DLlLTJNJ4TGH0": "TEST-01",
};

/**
 * SHA-256 hashes of normalized participant emails. The raw email list stays
 * in the ignored private directory and is never published to GitHub.
 * Replace these example hashes before issuing production links.
 */
export const EMAIL_HASHES: Readonly<Record<string, string>> = {
  "EXP-01": "tpHouGMP_W3H9T1uhw81XrQehKFHLgRvMqvFUQTII2M",
  "EXP-02": "fRw8PGgotEaBMYlZqceBtIsSi7AYMhzL6qbp2l9j0AY",
  "EXP-03": "bUE9g3xksqzAcmb5jyVj3_nBbPoYPKRAOOCH2aSx-p4",
  "EXP-04": "MB3nw5hnH_fF4SM-8yT-pjayFiiMOVmJxsagC9B0rt8",
  "EXP-05": "dy0PHvOubGIeXI7PD-krtff1dzaIDvr9szEMbPPB4cw",
  "EXP-06": "XHJ5ItLBoD58ec3BdX21wOWG3PrMi__ov87axiwt_q8",
  "TEST-01": "Zh2MQrO2psrvcCcW-cMsDxWeA5A586FWtjI1O2IOOoc",
};
