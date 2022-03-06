interface InnerErrorInterface {
    ActionUUID?: string,
    CreationDateTime?: string,
    ErrorMessage: string
}

export interface ErrorInterface {
    DistributorID: string,
    Name: string, 
    Code: string,
    Type: string,
    GeneralErrorMessage: string,
    InternalErrors?: InnerErrorInterface[],
    [key: string]: any
}

function IsInstanceOfHosteesData(object: any): object is ErrorInterface {
    let isValid = true;

    isValid = isValid && 'Code' in object;
    isValid = isValid && 'Type' in object;
    isValid = isValid && 'GeneralErrorMessage' in object;
    isValid = isValid && 'DistributorID' in object;
    isValid = isValid && 'Name' in object;

    if ('InternalErrors' in object) {
        object.InternalErrors.forEach(internalError => {
            isValid = isValid && 'ErrorMessage' in internalError;
            if (isValid === false) { return isValid; }
        });
    }

    return isValid;
}