import MyService from './my.service'
import { Client, Request } from '@pepperi-addons/debug-server'
import { PepperiUsageMonitorTable } from './installation'

// Function to be run from Pepperi Usage Monitor Addon Code Job
export async function run_collect_data(client: Client, request: Request) {
    const service = new MyService(client);
    let papiClient = service.papiClient;

    // Run main data collection function
    const res_collect_data = await collect_data(client, request);
    res_collect_data.Key = new Date(Date.now()).toISOString();

    // Insert results to ADAL
    await papiClient.addons.data.uuid(client.AddonUUID).table(PepperiUsageMonitorTable.Name).upsert(res_collect_data,);

    return res_collect_data;
}

export async function collect_data(client: Client, request: Request) {
    const service = new MyService(client);
    let papiClient = service.papiClient;

    let errors:{object:string, error:string}[] = [];
    
    const usersTask = papiClient.users.count({include_deleted:false});
    const accountsTask = papiClient.accounts.count({include_deleted:false});
    const itemsTask = papiClient.items.count({include_deleted:false});
    const catalogsTask = papiClient.catalogs.count({include_deleted:false});
    const contactsTask = papiClient.contacts.count({include_deleted:false});
    const buyersObjectsTask = papiClient.contacts.iter({include_deleted:false, where:'IsBuyer=true', fields:['InternalID']}).toArray();
    const profilesTask = papiClient.profiles.count({include_deleted:false});
    const transactionTypesTask = papiClient.metaData.type('transactions').types.get();
    const activityTypesTask = papiClient.metaData.type('activities').types.get();
    const accountTypesTask = papiClient.metaData.type('accounts').types.get();
    const transactionFieldsTask = papiClient.metaData.type('transactions').fields.get();
    const activityFieldsTask = papiClient.metaData.type('activities').fields.get();
    const transactionLineFieldsTask = papiClient.metaData.type('transaction_lines').fields.get();
    const itemFieldsTask = papiClient.metaData.type('items').fields.get();
    const accountFieldsTask = papiClient.metaData.type('accounts').fields.get();
    const userDefinedTablesTask = papiClient.metaData.userDefinedTables.iter({include_deleted:false}).toArray();

    // Working users/buyers created at least one new activity in all_activities in the last month.
    let lastMonth = new Date(Date.now());
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthString = lastMonth.toISOString();

    // Hack: shorten ISO format, remove the time. This is b/c papi cannot parse ISO string with decimal point for seconds.
    // See: https://pepperi.atlassian.net/browse/DI-18019
    const lastMonthStringWithoutTime = lastMonthString.split('T')[0] + 'Z';
    const allActivitiesUsersAndBuyersTask = papiClient.allActivities.count({where:"CreationDateTime>'" + lastMonthStringWithoutTime + "'", group_by:"CreatorInternalID"});

    const transactionsTask = papiClient.transactions.count({include_deleted:false});
    const activitiesTask = papiClient.activities.count({include_deleted:false});
    const transactionLinesTask = papiClient.transactionLines.count({include_deleted:false});
    const imagesTask = papiClient.images.count({where:'ImageType=1'});
    const userDefinedTablesLinesTask = papiClient.userDefinedTables.count({include_deleted:false});

    // Await all regular tasks
    let actualUsersCount: any = null;
    try {
        actualUsersCount = await usersTask;
    }
    catch (error) {
        errors.push({object:'ActualUsers', error:('message' in error) ? error.message : 'general error'});
    }

    let accountsCount: any = null;
    try {
        accountsCount = await accountsTask;
    } catch (error) {
        errors.push({object:'Accounts', error:('message' in error) ? error.message : 'general error'});
    }

    let itemsCount: any = null;
    try {
        itemsCount = await itemsTask;
    } catch (error) {
        errors.push({object:'Items', error:('message' in error) ? error.message : 'general error'});
    }

    let catalogsCount: any = null;
    try {
        catalogsCount = await catalogsTask;
    } catch (error) {
        errors.push({object:'Catalogs', error:('message' in error) ? error.message : 'general error'});
    }
    
    let contactsCount: any = null;
    try {
        contactsCount = await contactsTask;
    } catch (error) {
        errors.push({object:'Contacts', error:('message' in error) ? error.message : 'general error'});
    }

    let buyersObjects: any[] = [];
    let buyersCount: any = null;
    try {
        buyersObjects = await buyersObjectsTask;
        buyersCount = buyersObjects.length;
    } catch (error) {
        errors.push({object:'Buyers', error:('message' in error) ? error.message : 'general error'});
    }
    
    let profilesCount: any = null;
    try {
        profilesCount = await profilesTask;
    } catch (error) {
        errors.push({object:'Profiles', error:('message' in error) ? error.message : 'general error'});
    }

    let transactionTypesCount: any = null;
    try {
        transactionTypesCount = (await transactionTypesTask).length;
    } catch (error) {
        errors.push({object:'TransactionTypes', error:('message' in error) ? error.message : 'general error'});
    }

    let activityTypesCount: any = null;
    try {
        activityTypesCount = (await activityTypesTask).length;
    } catch (error) {
        errors.push({object:'ActivityTypes', error:('message' in error) ? error.message : 'general error'});
    }
    
    let accountTypesCount: any = null;
    try {
        accountTypesCount = (await accountTypesTask).length;
    } catch (error) {
        errors.push({object:'AccountTypes', error:('message' in error) ? error.message : 'general error'});
    }

    let transactionFieldsCount: any = null;
    try {
        transactionFieldsCount = (await transactionFieldsTask).length;
    } catch (error) {
        errors.push({object:'TransactionFields', error:('message' in error) ? error.message : 'general error'});
    }

    let activityFieldsCount: any = null;
    try {
        activityFieldsCount = (await activityFieldsTask).length;
    } 
    catch (error) {
        errors.push({object:'ActivityFields', error:('message' in error) ? error.message : 'general error'});
    }

    let transactionLineFieldsCount: any = null;
    try {
        transactionLineFieldsCount = (await transactionLineFieldsTask).length;
    } 
    catch (error) {
        errors.push({object:'TransactionLinesFields', error:('message' in error) ? error.message : 'general error'});
    }

    let itemFieldsCount: any = null;
    try {
        itemFieldsCount = (await itemFieldsTask).length;
    } 
    catch (error) {
        errors.push({object:'ItemFields', error:('message' in error) ? error.message : 'general error'});
    }

    let accountFieldsCount: any = null;
    try {
        accountFieldsCount = (await accountFieldsTask).length;
    } 
    catch (error) {
        errors.push({object:'AccountFields', error:('message' in error) ? error.message : 'general error'});
    }

    let userDefinedTablesCount: any = null;
    try {
        userDefinedTablesCount = (await userDefinedTablesTask).length;
    } 
    catch (error) {
        errors.push({object:'UserDefinedTables', error:('message' in error) ? error.message : 'general error'});
    }
    
    var workingUsers = 0;
    var workingBuyers = 0;
    // Iterate all working users and buyers, get which ones are buyers (the rest are users).
    try {
        const allActivitiesUsersAndBuyers = await allActivitiesUsersAndBuyersTask;

        // Iterate buyersObject, see which ones appear in allActivitiesUsersAndBuyers to get the number of working buyers (the rest are working users).
        buyersObjects.forEach(buyerObject => {
            const buyerInternalID = buyerObject['InternalID'] as number;
            allActivitiesUsersAndBuyers[buyerInternalID] && allActivitiesUsersAndBuyers[buyerInternalID] > 0 ? workingBuyers++ : null;
        });

        workingUsers = Object.keys(allActivitiesUsersAndBuyers).length - workingBuyers;
    }
    catch (error) {
        errors.push({object:'WorkingUsers', error:('message' in error) ? error.message : 'general error'});
    }

    let transactionsCount: any = null;
    try {
        transactionsCount = await transactionsTask;
    }
    catch (error) {
        errors.push({object:'Transactions', error:('message' in error) ? error.message : 'general error'});
    }
    
    let activitiesCount: any = null;
    try {
        activitiesCount = await activitiesTask;
    }
    catch (error) {
        errors.push({object:'Activities', error:('message' in error) ? error.message : 'general error'});
    }

    let transactionLinesCount: any = null;
    try {
        transactionLinesCount = await transactionLinesTask;
    }
    catch (error) {
        errors.push({object:'TransactionLines', error:('message' in error) ? error.message : 'general error'});
    }

    let imagesCount: any = null;
    try {
        imagesCount = await imagesTask;
    }
    catch (error) {
        errors.push({object:'Images', error:('message' in error) ? error.message : 'general error'});
    }

    let userDefinedTablesLinesCount: any = null;
    try {
        userDefinedTablesLinesCount = await userDefinedTablesLinesTask;
    } 
    catch (error) {
        errors.push({object:'UserDefinedTablesLines', error:('message' in error) ? error.message : 'general error'});
    }

    // Result object construction
    const result = {
        Setup:{},
        Usage:{},
        Data:{},
        Errors:{},
        Key:""
    };
    result.Setup = {
        LicensedUsers: null,
        ActualUsers: actualUsersCount, 
        Accounts: accountsCount,
        Items: itemsCount,
        Catalogs: catalogsCount,
        Contacts: contactsCount,
        Buyers: buyersCount,
        Profiles: profilesCount,
        TransactionTypes: transactionTypesCount,
        ActivityTypes: activityTypesCount,
        AccountTypes: accountTypesCount,
        TransactionFields: transactionFieldsCount,
        ActivityFields: activityFieldsCount,
        TransactionLineFields: transactionLineFieldsCount,
        ItemFields: itemFieldsCount,
        AccountFields: accountFieldsCount,
        UserDefinedTables: userDefinedTablesCount,
        SecurityGroups: null
    };

    result.Usage = {
        WorkingUsers: workingUsers,
        WorkingBuyers: workingBuyers
    }

    result.Data = {
        NucleusTransactions: transactionsCount,
        NucleusActivities: activitiesCount,
        NucleusTransactionLines: transactionLinesCount,
        DatabaseAllActivities: null,
        Images: imagesCount,
        UserDefinedTablesLines: userDefinedTablesLinesCount,
        Attachments: null
    }

    result.Errors = errors;
    
    return result;
}