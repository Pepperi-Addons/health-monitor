import { AUDIT_LOGS_WEEKS_RANGE } from "../entities";
import { BaseElasticSyncService } from "./base-elastic-sync.service";
import jwtDecode from "jwt-decode";

export abstract class BaseSyncAggregationService extends BaseElasticSyncService {
    distributorUUID: string;
    maintenanceWindow: number[] = [];
    
    constructor(client) {
        super(client);
        this.distributorUUID = jwtDecode(this.monitorSettingsService.clientData.OAuthAccessToken)['pepperi.distributoruuid'];
    }
    protected abstract getStatusAggregationQuery();

    protected abstract getSyncAggregationQuery(aggregationQuery, datesRange);

    // calculate dates range of previous month logs
    protected getLastMonthLogsDates() {
        const today= new Date();
        const dateMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, 0); // get the last day of previous month
        
        const logsStartDate = new Date(today.getDate() - (AUDIT_LOGS_WEEKS_RANGE * 7)); // get AUDIT_LOGS_WEEKS_RANGE weeks ago date
        const firstLogsDay = logsStartDate.getMonth() === dateMonthAgo.getMonth() ? logsStartDate.getDate() : 1;

        return `${firstLogsDay}-${dateMonthAgo.getDate()}/${dateMonthAgo.getMonth() + 1}`; // return dates range in dd1-dd2/mm format
      }
  
}