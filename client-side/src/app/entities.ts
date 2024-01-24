export const SmartFiltersSyncFields = {
    "CreationDateTime": 'DateTime',
    "ModificationDateTime": 'DateTime',
    "Event.User.Email.keyword": 'String',
    "Status.Name.keyword": 'String',
    "AuditInfo.JobMessageData.NumberOfTry": 'Integer'
}

export const SmartFiltersInternalSyncFields = {
    "AuditInfo.JobMessageData.StartDateTime": 'DateTime',
    "Status.Name.keyword": 'String'
}

export const SearchSyncFields = {
    "UUID.keyword": 'String',
    "Event.User.Email.keyword": 'String'
}

export const SearchInternalSyncFields = {
    "UUID.keyword": 'String'
}