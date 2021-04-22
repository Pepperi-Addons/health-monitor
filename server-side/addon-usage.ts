import MyService from './my.service'
import { Client, Request } from '@pepperi-addons/debug-server'
import { PapiClient, CodeJob } from "@pepperi-addons/papi-sdk";
import jwtDecode from "jwt-decode";
import fetch from "node-fetch";

export async function daily_addon_usage(client: Client, request: Request) {
    console.log('HealthMonitorAddon start daily addon usage');
    try {
        const service = new MyService(client);
        const now = Date.now();
        const startTime = new Date(now-24*3600*1000).setHours(0,0,0,0);
        const endTime = new Date(now).setHours(0,0,0,0);

        const cloudWatchBody = {
            StartDateTime: startTime,
            EndDateTime: endTime
        }
        const cloudWatchResult = await service.papiClient.post("/addons/api/async/00000000-0000-0000-0000-000000000a91/api/getAddonsUsageFromCWL", cloudWatchBody);

        // upload to adal
        const addonsUsage = {};
        cloudWatchResult.forEach(result => {
            addonsUsage[result[0].value]= {Count:result[1].value, Duration:result[2].value};
        });
        const nowDate = new Date(now);
        const dailyAddonUsageBody= {
            Key: nowDate.toLocaleDateString(),
            AddonsUsage: addonsUsage
        };
        const dailyAddonUsageResponse = await service.papiClient.addons.data.uuid(client.AddonUUID).table('DailyAddonUsage').upsert(dailyAddonUsageBody);
        console.log('HealthMonitorAddon ended daily addon usage');

        // check conditions for problematic use of lambdas
        if (problem){

        }
        
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