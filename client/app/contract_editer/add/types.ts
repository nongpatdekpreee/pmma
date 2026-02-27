  export interface SiteLocation {
    SLid: number;
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
}

