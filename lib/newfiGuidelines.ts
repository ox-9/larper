export type NewfiTab = "NON-QM" | "DSCR";

export type NewfiGuidelineRow = {
  rowNumber: number;
  tab: NewfiTab;
  category: string;
  topic: string;
  newfiGuideline: string;
};

// Mock internal Newfi guideline data.
// This establishes the internal data shape for later stored-row + AI comparison work.
export const newfiGuidelineRows: NewfiGuidelineRow[] = [
  {
    rowNumber: 1,
    tab: "NON-QM",
    category: "Eligibility",
    topic: "Loan Purpose",
    newfiGuideline:
      "Seller guide must clearly state loan purpose (purchase or refinance) and confirm the requested product aligns with NON-QM execution rules.",
  },
  {
    rowNumber: 2,
    tab: "NON-QM",
    category: "Documentation",
    topic: "Income Documentation",
    newfiGuideline:
      "Self-employed income must be supported with acceptable documentation and shown using the internal Non-QM income approach.",
  },
  {
    rowNumber: 3,
    tab: "NON-QM",
    category: "Borrower Profile",
    topic: "Credit Requirements",
    newfiGuideline:
      "Seller guide should reflect credit history expectations per internal Non-QM underwriting guidelines (minimums and tolerances).",
  },
  {
    rowNumber: 4,
    tab: "NON-QM",
    category: "Underwriting",
    topic: "DTI / Payment Stress",
    newfiGuideline:
      "Seller guide must provide the borrower payment profile used to evaluate debt-to-income and payment stress under Non-QM rules.",
  },
  {
    rowNumber: 5,
    tab: "NON-QM",
    category: "Reserves",
    topic: "Cash Reserves",
    newfiGuideline:
      "Verify reserves are documented and consistent with internal Non-QM guideline thresholds for the applicable loan scenario.",
  },
  {
    rowNumber: 6,
    tab: "DSCR",
    category: "Property & Cash Flow",
    topic: "DSCR Minimum",
    newfiGuideline:
      "DSCR must be calculated from internal net operating income assumptions and meet the minimum DSCR requirement for the deal.",
  },
  {
    rowNumber: 7,
    tab: "DSCR",
    category: "Income Calculation",
    topic: "NOI Inputs",
    newfiGuideline:
      "Seller guide should include NOI inputs (income, vacancy/expense assumptions) used in the DSCR computation, matching the internal DSCR model.",
  },
  {
    rowNumber: 8,
    tab: "DSCR",
    category: "Documentation",
    topic: "Rental History",
    newfiGuideline:
      "Rental income and related documentation must be present and align with internal DSCR evidence requirements for the subject property.",
  },
  {
    rowNumber: 9,
    tab: "DSCR",
    category: "Underwriting",
    topic: "Escrow / Fees",
    newfiGuideline:
      "Seller guide should capture the fee and escrow components affecting the effective payment used in DSCR qualification.",
  },
  {
    rowNumber: 10,
    tab: "DSCR",
    category: "Scenario Rules",
    topic: "Refinance Constraints",
    newfiGuideline:
      "For refinance transactions, seller guide must include any required seasoning/constraints that the internal DSCR benchmark expects.",
  },
];

export const tabsAvailable: NewfiTab[] = ["NON-QM", "DSCR"];

export const newfiRowCount = newfiGuidelineRows.length;

