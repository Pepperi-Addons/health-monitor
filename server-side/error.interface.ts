import tableif from "tableify"

export interface InnerErrorInterface {
    ActionUUID?: string,
    CreationDateTime?: string,
    ErrorMessage: string,
}

export interface ErrorInterface {
    DistributorID: string,
    Name: string, 
    Code: string,
    Type: string,
    AddonUUID?: string
    GeneralErrorMessage: string,
    InternalErrors?: InnerErrorInterface[],
    [key: string]: any
}

export function IsInstanceOfErrorInterface(object: any): object is ErrorInterface {
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

export function ErrorInterfaceToHtmlTable(errorArray: InnerErrorInterface[]): string {
    let tableObject = new Array();

    errorArray!.forEach(errorData => {
        tableObject.push({
            CreationDateTime: errorData.CreationDateTime,
            ActionUUID: errorData.ActionUUID,
            ErrorMessage: errorData.ErrorMessage
        });
    });

    const htmlTable = tableif(tableObject);
    return htmlTable;
}
