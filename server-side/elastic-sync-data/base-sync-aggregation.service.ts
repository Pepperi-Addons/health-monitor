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
        const monthAgo = (new Date((new Date()).setMonth(today.getMonth() - 1))).getMonth();

        const thisMonthFirstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const prevMonthLastDay = new Date(thisMonthFirstDay.getTime() - 1);
        
        const logsStartDate = new Date(today.getTime() - (AUDIT_LOGS_WEEKS_RANGE * 7 * 24 * 60 * 60 * 1000)); // AUDIT_LOGS_WEEKS_RANGE weeks ago
        const firstLogsDay = logsStartDate.getMonth() === monthAgo ? logsStartDate.getDate() : 1;
        return `${firstLogsDay}-${prevMonthLastDay.getDate()}/${monthAgo + 1}`;
      }
  
}