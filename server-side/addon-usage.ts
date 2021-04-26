import MyService from './my.service'
import { Client, Request } from '@pepperi-addons/debug-server'
import jwtDecode from "jwt-decode";
import fetch from "node-fetch";

const errors = {
    "DAILY-ADDON-USAGE-LIMIT-REACHED":{"Message":'Distributor passed the daily addon usage limit', "Color":"FF0000"},
    "MONTHLY-ADDON-USAGE-LIMIT-REACHED":{"Message":'Distributor passed the monthly addon usage limit', "Color":"FF0000"},
    "UNKNOWN-ERROR":{"Message":'Unknown error occured, contact rnd to fix this', "Color":"990000"},
};

export async function daily_addon_usage(client: Client, request: Request) {
    console.log('HealthMonitorAddon start daily addon usage');
    const service = new MyService(client);
    const distributor = await service.papiClient.get('/distributor');
    const now = Date.now();

    try {
        // get the daily memory usage per addon from CloudWatch
        const cloudWatchLogs = await getcloudWatchLogs(service, now);
        const dailyAddonUsage = await upsertDailyAddonUsageToADAL(client, service, cloudWatchLogs, now);

        // check conditions for problematic use of lambdas, create report and alert problems
        const memoreUsageLimit = 5000000;
        const dailyReport = await getDailyReport(service, distributor, dailyAddonUsage, memoreUsageLimit); 
        const monthlyReport = await getMonthlyReport(client, service, distributor, memoreUsageLimit);

        console.log('HealthMonitorAddon ended daily addon usage');
        return {
            success: true, 
            resultObject: {DailyPassedLimit: dailyReport["PassedLimit"], MonthlyPassedLimit: monthlyReport["PassedLimit"]}
        };
    }
    catch (err) {
        console.log(`HealthMonitorAddon daily addon usage failed with err: ${err.message}`);
        const innerMessage = ('message' in err) ? err.message : 'Unknown Error Occured'
        reportError(service, distributor, 'ADDON-USAGE','UNKNOWN-ERROR', innerMessage);
        return {
            success: false,
            errorMessage: innerMessage,
        }
    }
};

//#region private methods

async function getcloudWatchLogs(service, now){
    const startTime = new Date(now-24*3600*1000).setHours(0,0,0,0);
    const endTime = new Date(now).setHours(0,0,0,0);
    const cloudWatchBody = {
        StartDateTime: new Date(startTime).toISOString(),
        EndDateTime: new Date(endTime).toISOString()
    }
    const cloudWatchResponse = await service.papiClient.post("/addons/api/00000000-0000-0000-0000-000000000a91/api/getAddonsUsageFromCWL", cloudWatchBody);
    return cloudWatchResponse;
}

async function upsertDailyAddonUsageToADAL(client, service, cloudWatchLogs, now) {
    const nowDate = new Date(now);
    const dailyAddonUsageBody= {
        Key: nowDate.toLocaleDateString(),
        AddonsUsage: cloudWatchLogs,
        ExpirationDateTime: getExpirationDateTime()
    };
    const dailyAddonUsageResponse = await service.papiClient.addons.data.uuid(client.AddonUUID).table('DailyAddonUsage').upsert(dailyAddonUsageBody);
    return dailyAddonUsageResponse;
}

async function getDailyReport(service, distributor, dailyAddonUsage, memoreUsageLimit) {
    const dailyReport = { PassedLimit: new Array(), NotPassedLimit: new Array() };
    if(dailyAddonUsage != null && dailyAddonUsage.AddonsUsage != null && Object.keys(dailyAddonUsage.AddonsUsage).length > 0){
        const addonsUsage = dailyAddonUsage.AddonsUsage;
        for (var item in addonsUsage) {
            if (addonsUsage[item].MemoryUsage != null && addonsUsage[item].MemoryUsage>memoreUsageLimit){
                const innerMessage = "AddonUUID "+item + " reached the memory usage limit - " + addonsUsage[item].MemoryUsage;
                reportError(service, distributor, "ADDON-USAGE", "DAILY-ADDON-USAGE-LIMIT-REACHED", innerMessage);
                dailyReport["PassedLimit"].push(item);
            }
            else if (addonsUsage[item].MemoryUsage != null && addonsUsage[item].MemoryUsage<memoreUsageLimit){
                dailyReport["NotPassedLimit"].push(item);
            }
        }
    }
    return dailyReport;
}

async function getMonthlyReport(client, service, distributor, memoreUsageLimit) {
    const monthlyReport = { PassedLimit: new Array(), NotPassedLimit: new Array() };
    const monthlyAddonUsageResponse = await service.papiClient.addons.data.uuid(client.AddonUUID).table('DailyAddonUsage').iter({order_by:"CreationDateTime desc", page_size:30}).toArray();
    const monthlyAddonUsage = new Array();
    let addonsUsage ={};
    monthlyAddonUsageResponse.forEach(dailyAddonsUsage => {
        addonsUsage = dailyAddonsUsage.AddonsUsage;
        for (var item in addonsUsage) {
            monthlyAddonUsage[item] = {
                Count: monthlyAddonUsage[item]? monthlyAddonUsage[item].Count + addonsUsage[item].Count : addonsUsage[item].Count,
                Duration: monthlyAddonUsage[item]? monthlyAddonUsage[item].Duration + addonsUsage[item].Duration : addonsUsage[item].Duration,
                MemoryUsage: monthlyAddonUsage[item]? monthlyAddonUsage[item].MemoryUsage + addonsUsage[item].MemoryUsage : addonsUsage[item].MemoryUsage
            };
        }
    });
    if (monthlyAddonUsage != null && Object.keys(monthlyAddonUsage).length > 0){
        for (var item in monthlyAddonUsage) {
            if (monthlyAddonUsage[item].MemoryUsage != null && monthlyAddonUsage[item].MemoryUsage>(memoreUsageLimit*10)){
                const innerMessage = "AddonUUID "+item + " reached the memory usage limit - " + monthlyAddonUsage[item].MemoryUsage;
                reportError(service, distributor, "ADDON-USAGE", "MONTHLY-ADDON-USAGE-LIMIT-REACHED", innerMessage);
                monthlyReport["PassedLimit"].push(item);
            }
            else if (monthlyAddonUsage[item].MemoryUsage != null && monthlyAddonUsage[item].MemoryUsage<(memoreUsageLimit*10)){
                monthlyReport["NotPassedLimit"].push(item);
            }
        }
    }
    return monthlyReport;
}

function getExpirationDateTime(){
    // the ExpirationDateTime is 2 years
    let expirationDateTime = new Date(Date.now());
    expirationDateTime.setFullYear(expirationDateTime.getFullYear()+2);
    return expirationDateTime.toISOString();
}

async function reportError(service, distributor, errorCode, type, innerMessage) {
    const environmant = jwtDecode(service.client.OAuthAccessToken)["pepperi.datacenter"];
    // report error to cloud watch
    let error = 'DistributorID: '+distributor.InternalID+'\n\rName: '+distributor.Name+'\n\rType: ' + type+ '\n\rCode: ' + errorCode + '\n\rMessage: '+ errors[errorCode]["Message"] + '\n\rInnerMessage: '+ innerMessage;
    console.error(error);

    // report error to teams on System Status chanel
    let url;
    const body = {
        themeColor: errors[errorCode]["Color"],
        Summary: distributor.InternalID + " - "+distributor.Name,
        sections: [{
            facts: [{
                name: "Distributor ID",
                value: distributor.InternalID
            },{
                name: "Name",
                value: distributor.Name
            },{
                name: "Code",
                value: errorCode
            },{
                name: "Type",
                value: type
            }, {
                name: "Message",
                value: errors[errorCode]["Message"]
            }, {
                name: "Inner Message",
                value: innerMessage
            }],
            "markdown": true
        }]
    }

    if (environmant=='sandbox'){
        url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/e5f4ab775d0147ecbb7f0f6bdf70aa0b/4361420b-8fde-48eb-b62a-0e34fec63f5c';
    }
    else{
        url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/0db0e56f12044634937712db79f704e1/4361420b-8fde-48eb-b62a-0e34fec63f5c';
    }

    var res = await fetch(url, {
        method: "POST", 
        body: JSON.stringify(body)
    });
}

//#endregion