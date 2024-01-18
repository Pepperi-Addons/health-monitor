export const SYNC_UUID = '00000000-0000-0000-0000-000000abcdef';

export const syncPageSize = 1;

export type SystemHealthBody= {
    Status: string;
    Message: string;
}

export const errors = {
    "SUCCESS": { "Message": 'SyncFailed test succeeded', "Color": "00FF00" },
    "JOB-EXECUTION-REPORT": { "Message": 'JobExecutionFailed test finished', "Color": "990000" },
    "JOB-LIMIT-SUCCESS": { "Message": 'JobLimitReached test finished', "Color": "00FF00" },
    "TEST-MESSAGE": { "Message": 'test message', "Color": "00FF00" },
    "UNKNOWN-ERROR": { "Message": 'Unknown error occured, contact rnd to fix this', "Color": "990000" },
    "GET-UDT-FAILED": { "Message": 'Get udt failed, Pls confirm NUC is not available and recycle if needed', "Color": "FF0000" },
    "GET-ADAL-FAILED": { "Message": 'Get adal by key failed, Pls confirm NUC is not available and recycle if needed', "Color": "FF0000" },
    "SYNC-UPDATE-FAILED": { "Message": 'Sync status is done but Values field on map data have not been updated, Pls confirm NUC is not available and recycle if needed', "Color": "FF0000" },
    "SYNC-FAILED": { "Message": 'Sync response status is Failed, Pls confirm NUC is not available and recycle if needed', "Color": "FF0000" },
    "SYNC-CALL-FAILED": { "Message": 'Sync api call Failed, Pls confirm NUC is not available and recycle if needed', "Color": "FF0000" },
    "PASSED-ADDON-LIMIT": { "Message": 'Distributor passed the addon limit', "Color": "FF0000" },
    "PASSED-JOB-LIMIT": { "Message": 'Distributor passed the job limit', "Color": "FF0000" },
    "TIMEOUT-GET-UDT": { "Message": 'Get udt call timeout', "Color": "FF0000" },
    "TIMEOUT-SYNC": { "Message": 'Sync call timeout', "Color": "FF0000" },
    "TIMEOUT-SYNC-FAILED-TEST": { "Message": 'sync_failed test got timeout', "Color": "FF0000" }
};

export const SYNCS_PAGE_SIZE = 200;

export const SYNC_FUNCTION_NAME = "sync";

export const AUDIT_LOG_INDEX = 'audit_log';

export const AUDIT_LOGS_WEEKS_RANGE = 5;

