export module Utils {

    export function GetErrorDetailsSafe(error: unknown, field = "message", defaultValue = 'Unknown Error Occured'): string {

        try {
            if (error instanceof Error) {
                if (field in error) {
                    return error[field];
                }
            }
        }
        catch { }

        return defaultValue;
    }
} export default Utils;