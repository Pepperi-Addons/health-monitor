export interface HosteesInternalErrors {
    ErrorMessage: string,
    ActionUUID?: string,
    CreationDateTime?: string
}

export interface HosteesData {
    Code: string,
    Type: string,
    GeneralErrorMessage: string,
    InternalErrors?: HosteesInternalErrors[],
    [key: string]: any
}

export function IsInstanceOfHosteesData(object: any): object is HosteesData {
    let isValid = true;

    isValid = isValid && 'Code' in object;
    isValid = isValid && 'Type' in object;
    isValid = isValid && 'GeneralErrorMessage' in object;

    if ('InternalErrors' in object) {
        object.InternalErrors.forEach(internalError => {
            isValid = isValid && 'ErrorMessage' in internalError;
            if (isValid === false) { return isValid; }
        });
    }

    return isValid;
}

export default HosteesData;