import { BaseSyncAggregationService } from "./base-sync-aggregation.service";

export class UptimeSync extends BaseSyncAggregationService {
    
    codeJobUUID: string = '';
    monitorLevel: number = 0;
    maintenanceWindow: number[] = [];
    
    fixElasticResultObject(auditLogData) {
      let res = {};
      auditLogData.resultObject.aggregations.aggregation_buckets.buckets.forEach((item) => {
        const count = item.status_filter.buckets.failures.doc_count;
        // The value is the number of sync monitor jobs runs that failed, multiply by 5 divide by 1440(=minutesInADay)-maintenanceWindowMinutes (120 minutes).
        // (since each retry means 5 minutes without work.)
        const calculatedFailedSyncs = ((count * 5) / (1440 - 120) * 100).toFixed(2);
        res[item.key_as_string] = `${calculatedFailedSyncs}%`; // update each month uptime sync value
      });
      return res;
    }

    async getSyncsResult() {
      this.maintenanceWindow = await this.getMaintenanceWindowHours();
      const jobData = await this.monitorSettingsService.getMonitorSettings();

      this.codeJobUUID = jobData.SyncFailedCodeJobUUID;
      this.monitorLevel = jobData.MonitorLevel; // uptime sync cards are not available for monitor level 'Never'

      return await this.getUptimeSync();
    }

    getStatusAggregationQuery() {
      return { 
        "aggs": {
            "aggregation_buckets": {
                "date_histogram": {
                    "field": "AuditInfo.JobMessageData.StartDateTime",
                    "calendar_interval": "1M",
                    "format": "MM/yyyy",
                    "min_doc_count": 0,
                    "extended_bounds": {
                        "min": "now/M-1M/M",
                        "max": "now/M"
                    }
                },
                "aggs": {
                  "status_filter": {
                    "filters": {
                      "filters": {
                        "failures": {
                          "bool": {
                            "must": [
                              {
                                "term": {
                                  "Status.Name.keyword": "Failure"
                                }
                              }
                            ]
                          }
                        }
                      }
                    }
                  }
                }
            }
        }
      }
    }

    async getUptimeSync() {
      if(this.monitorLevel) {
        const monthlyDatesRange = {
          "range": {
            "AuditInfo.JobMessageData.StartDateTime": {
              "gte": "now/M-1M/M", 
              "lt": "now"
            }
          }
        }
  
        const aggregationQuery = this.getStatusAggregationQuery();
        const auditLogData = await this.getElasticData(this.getSyncAggregationQuery(aggregationQuery, monthlyDatesRange));
        const lastMonthDates = this.getLastMonthLogsDates()
  
        return { UptimeSync: { data: this.fixElasticResultObject(auditLogData) , dates: lastMonthDates } };
      }
    }

    getSyncAggregationQuery(aggregationQuery, auditLogDateRange) {
      return {
        "size": 0,
        "query": {
          "bool": {
            "must": [
              this.createQueryTerm("AuditInfo.JobMessageData.AddonData.CodeJobUUID.keyword", this.codeJobUUID),
              this.getMaintenanceWindowHoursScript(this.maintenanceWindow),
              auditLogDateRange
            ]
          }
        },
        ...aggregationQuery 
      }
  }
}