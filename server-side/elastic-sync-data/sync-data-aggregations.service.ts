import { SYNC_FUNCTION_NAME, SYNC_UUID } from "../entities";
import { BaseElasticSyncService } from "./base-elastic-sync.service";
import jwtDecode from "jwt-decode";

export class SyncDataAggregations extends BaseElasticSyncService {
    
    distributorUUID: string;
    maintenanceWindow: number[];
    
    constructor(client, maintenanceWindow: number[]) {
        super(client);
        this.distributorUUID = jwtDecode(this.monitorSettingsService.clientData.OAuthAccessToken)['pepperi.distributoruuid'];
        this.maintenanceWindow = maintenanceWindow;
    }

    fixElasticResultObject(res, aggregationFieldName = "aggregation_buckets") {
        let jobStatus = {};
        const fixedObject = res.resultObject.aggregations[aggregationFieldName].buckets;

        if(aggregationFieldName === "status_filter") {
            jobStatus['data'] = Object.values(fixedObject).map((item: any) => { return item.doc_count })
        } else if(aggregationFieldName === "aggregation_buckets") {
            jobStatus['dates'] = fixedObject.map((item) => { return item.key_as_string });
            jobStatus['data'] = fixedObject.map((item) => { return Object.values(item.status_filter.buckets).map((element: any) => { return element.doc_count })})
        }
        
        return jobStatus;
    }

    async getSyncsResult() {
        this.maintenanceWindow = await this.getMaintenanceWindowHours();
        return {
            "HourlySyncs": await this.getHourlySyncs(),
            "LastDaySyncs": await this.getlastDaySyncs(),
            "WeeklySyncs": await this.getWeeklySyncs(),
            "MonthlySyncs": await this.getMonthlySyncs()
        }
    }    

    // get all the syncs distributed by hours (in the last 24 hours), filtered by success, delayed and failure
    private async getHourlySyncs() {
        const hourlyDatesRange = {
            "range": {
            "AuditInfo.JobMessageData.StartDateTime": {
                    "gte": "now-24h",
                    "lt": "now"
                }
            }
        }

        const aggregationQuery = { 
            "aggs": {
                "aggregation_buckets": {
                    "date_histogram": {
                        "field": "AuditInfo.JobMessageData.StartDateTime",
                        "interval": "1h",
                        "format": "HH:mm",
                        "extended_bounds": {
                            "min": "now-24h",
                            "max": "now"
                        }
                    },
                    ...this.getStatusAggregationQuery()
                }
            }
        }

        const body = this.getSyncAggregationQuery(aggregationQuery, hourlyDatesRange);
        const res = await this.getElasticData(body);
        return this.fixElasticResultObject(res);
    }

    // get all syncs in the last 24 hours
    private async getlastDaySyncs() {
        const dailyDatesRange = {
            "range": {
                "AuditInfo.JobMessageData.StartDateTime": {
                    "gte": "now-24h",
                    "lt": "now"
                }
            }
        }

        const body = this.getSyncAggregationQuery(this.getStatusAggregationQuery(), dailyDatesRange);
        const auditLogData = await this.getElasticData(body);
        return this.fixElasticResultObject(auditLogData, 'status_filter');
    }

    // get all syncs in the last 7 days, distributed by weeks
    private async getWeeklySyncs() {
        const weeklyDatesRange = {
            "range": {
                "AuditInfo.JobMessageData.StartDateTime": {
                  "gte": "now-5w/w-1w/d",
                  "lt": "now"
                }
              }
        }

        const aggregationQuery = { 
            "aggs": {
                "aggregation_buckets": {
                    "date_histogram": {
                    "field": "AuditInfo.JobMessageData.StartDateTime",
                    "calendar_interval": "1w",
                    "offset": "-1d",
                    "format": "dd-MM-yyyy",
                    "min_doc_count": 0
                    },
                    ...this.getStatusAggregationQuery()
                }
            }
        }

        const body = this.getSyncAggregationQuery(aggregationQuery, weeklyDatesRange);

        const auditLogData = await this.getElasticData(body);
        return this.fixElasticResultObject(auditLogData);
    }

    // get all the syncs distributed by months (in the last 2 months)
    private async getMonthlySyncs() {
        const monthlyDatesRange = {
            "range": {
              "AuditInfo.JobMessageData.StartDateTime": {
                "gte": "now/M-1M/M", 
                "lt": "now"
              }
            }
        }

        const aggregationQuery = { 
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
                    ...this.getStatusAggregationQuery()
                }
            }
        }

        const body = this.getSyncAggregationQuery(aggregationQuery, monthlyDatesRange);
        
        const auditLogData = await this.getElasticData(body);
        return this.fixElasticResultObject(auditLogData);
    }

    private getSyncAggregationQuery(statusesAggregation, auditLogDateRange) {
        return {
            "size": 0,
            "query": {
              "bool": {
                "must": [
                    this.createQueryTerm("AuditInfo.JobMessageData.AddonData.AddonUUID.keyword", SYNC_UUID),
                    this.createQueryTerm("DistributorUUID", this.distributorUUID),
                    this.createQueryTerm("AuditInfo.JobMessageData.FunctionName.keyword", SYNC_FUNCTION_NAME),
                    this.getMaintenanceWindowHoursScript(this.maintenanceWindow),
                    auditLogDateRange
                ]
              }
            },
            ...statusesAggregation
          }
    }

    // get status aggregation query, filtered by success, delayed and failure
    private getStatusAggregationQuery() {
        return {
            "aggs": {
                "status_filter": {
                  "filters": {
                    "filters": {
                      "success": {
                        "bool": {
                          "must": [
                            {
                              "term": {
                                "Status.Name.keyword": "Success"
                              }
                            },
                            {
                              "range": {
                                "AuditInfo.JobMessageData.NumberOfTry": {
                                  "lt": 12
                                }
                              }
                            }
                          ]
                        }
                      },
                      "delayed": {
                        "bool": {
                          "must": [
                            {
                              "term": {
                                "Status.Name.keyword": "Success"
                              }
                            },
                            {
                              "range": {
                                "AuditInfo.JobMessageData.NumberOfTry": {
                                  "gte": 12
                                }
                              }
                            }
                          ]
                        }
                      },
                      "failure": {
                        "term": {
                          "Status.Name.keyword": "Failure"
                        }
                      }
                    }
                  }
                }
              }
        }
    }
}