import MyService from './my.service'
import { Client, Request } from '@pepperi-addons/debug-server'
import { PapiClient, CodeJob } from "@pepperi-addons/papi-sdk";
import jwtDecode from "jwt-decode";
import fetch from "node-fetch";

export async function daily_addon_usage(client: Client, request: Request) {
    console.log('HealthMonitorAddon start daily addon usage');
    try {
        const service = new MyService(client);
        const distributorUUID = jwtDecode(client.OAuthAccessToken)["pepperi.distributoruuid"];
        const now = Date.now();
        const AWS = require('aws-sdk');
        const cwl = new AWS.CloudWatchLogs();
        
        // create query
        const logGroupsParams = {};
        const logGroups = (await cwl.describeLogGroups(logGroupsParams).promise()).logGroups;
        const relevantLogGroups = logGroups.filter(x=> x.logGroupName.includes('Addon') && x.logGroupName.includes('Execute')).map(x=> x.logGroupName);
        const startTime = new Date(now-24*3600*1000).setHours(0,0,0,0);
        const endTime = new Date(now).setHours(0,0,0,0);

        const startQueryParams = {
            startTime: startTime,
            endTime: endTime, 
            queryString: `fields @timestamp
            | sort @timestamp desc
            | filter Duration>0 and DistributorUUID='${distributorUUID}'
            | stats count(*),sum(Duration) by AddonUUID`,
            logGroupNames: relevantLogGroups
        };
        const queryId = (await cwl.startQuery(startQueryParams).promise()).queryId;

        // get query results
        const queryResultsParams = {
            queryId: queryId
        };

        let queryResults = await cwl.getQueryResults(queryResultsParams).promise();
        while (queryResults.status != 'Complete'){
            await sleep(1000);
            queryResults = await cwl.getQueryResults(queryResultsParams).promise();
        }

        // upload to adal
        const addonsUsage = {};
        queryResults.results.forEach(result => {
            addonsUsage[result[0].value]= {Count:result[1].value, Duration:result[2].value};
        });
        const nowDate = new Date(now);
        const dailyAddonUsageBody= {
            Key: nowDate.toLocaleDateString(),
            AddonsUsage: addonsUsage
        };
        const dailyAddonUsageResponse = await service.papiClient.addons.data.uuid(client.AddonUUID).table('DailyAddonUsage').upsert(dailyAddonUsageBody);
        console.log('HealthMonitorAddon ended daily addon usage');
        return;
    }
    catch (err) {
        console.log(`HealthMonitorAddon daily addon usage failed with err: ${err.message}`);
        return err;
    }
};

const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};