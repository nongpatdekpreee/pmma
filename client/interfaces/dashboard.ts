export type SummaryCard = {
  label: string;
  value: string;
  growth?: string;
};

export type ContractStatus =
  | "Done"
  | "In Progress"
  | "Not Started"
  | "Scheduled";

export type ContractRow = {
  assetName: string;
  site: string;
  vendor: string;
  pmDate: string;
  status: ContractStatus;
};
