import { SYNCS_PAGE_SIZE } from "../entities";
import { BaseElasticSyncService } from "./base-elastic-sync.service";

export class InternalSyncService extends BaseElasticSyncService {
    
    async getSyncsResult() {
        const codeJobUUID = (await this.monitorSettingsService.getMonitorSettings()).SyncFailedCodeJobUUID;
        const query: string = `AuditInfo.JobMessageData.CodeJobUUID.keyword='${codeJobUUID}'`;

        const requestedBody = this.getElasticBody(query, { "AuditInfo.JobMessageData.CodeJobUUID.keyword" : 'String' }, SYNCS_PAGE_SIZE);
        const res = await this.getElasticData(requestedBody);
        return this.handleResultObject(res);
    }

    handleResultObject(res) {
        return res.resultObject.hits.hits.map((item) => {
            let jobStatus = 'Failed';
            if(item._source.AuditInfo.ResultObject) {
                const status = JSON.parse(item._source.AuditInfo.ResultObject);
                jobStatus = status.success ? 'Success' : 'Failed';
            }
            return {
                UUID: item._source.UUID,
                Status: item._source.CreationDateTime,
                StartDateTime: item._source.AuditInfo.JobMessageData.StartDateTime,
                EndDateTime: item._source.AuditInfo.JobMessageData.EndDateTime,
                ResultStatus: jobStatus
            };
        });
    }
}