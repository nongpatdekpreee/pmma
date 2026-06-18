  export interface SiteLocation {
    SLid: number;
    Sid?: number;
    lid?: number;
    SiteName: string;
    Location2: string;
  }

export interface DeviceItem {
    Did:number;
    CI_Name:string | null;
    Asset_Number:string | null;
    serial?: string | null;
    model?: string | null;
    roleName?: string | null;
    manufacturername?: string | null;
    SLid?: number | null;
    contract_SLid?: number | null;
}

export interface ContractSiteRow {
    SLid: number;
    SiteName?: string | null;
    Location2?: string | null;
}

