import { Injectable } from "@angular/core";
import { PepAddonService, PepHttpService } from "@pepperi-addons/ngx-lib";
import {
  PepDialogService,
  PepDialogActionButton,
} from "@pepperi-addons/ngx-lib/dialog";
import { PepDialogData } from "@pepperi-addons/ngx-lib/dialog";
 
@Injectable({
  providedIn: "root",
})
export class AppService {
  //idpToken =
  //  "eyJhbGciOiJSUzI1NiIsImtpZCI6IjRiYTFjNzJmMTI3NThjYzEzMzg3ZWQ3YTBiZjNlODg3IiwidHlwIjoiSldUIn0.eyJuYmYiOjE2MDYzMTA0NTQsImV4cCI6MTYwNjMxNDA1NCwiaXNzIjoiaHR0cHM6Ly9pZHAuc2FuZGJveC5wZXBwZXJpLmNvbSIsImF1ZCI6WyJodHRwczovL2lkcC5zYW5kYm94LnBlcHBlcmkuY29tL3Jlc291cmNlcyIsInBlcHBlcmkuYXBpbnQiXSwiY2xpZW50X2lkIjoiaW9zLmNvbS53cm50eS5wZXBwZXJ5Iiwic3ViIjoiZTJkZmQ0MDYtZDM4Yy00ZmYwLThhZGItMWRlMjI3ODIzYWEyIiwiYXV0aF90aW1lIjoxNjA2MzEwNDU0LCJpZHAiOiJsb2NhbCIsInBlcHBlcmkuYXBpbnRiYXNldXJsIjoiaHR0cHM6Ly9yZXN0YXBpLnNhbmRib3gucGVwcGVyaS5jb20iLCJlbWFpbCI6ImRhbmllbC5kQHBlcHBlcml0ZXN0LmNvbSIsInBlcHBlcmkuaWQiOjg2OTAzMDQsInBlcHBlcmkudXNlcnV1aWQiOiJlMmRmZDQwNi1kMzhjLTRmZjAtOGFkYi0xZGUyMjc4MjNhYTIiLCJwZXBwZXJpLmRpc3RyaWJ1dG9ydXVpZCI6IjBiZDBlZDc5LThlOWUtNDRmYi05NmY0LThlNTNlZDljZTgyYiIsInBlcHBlcmkuZGlzdHJpYnV0b3JpZCI6MzAwMTIzNTEsInBlcHBlcmkuZGF0YWNlbnRlciI6InNhbmRib3giLCJwZXBwZXJpLmVtcGxveWVldHlwZSI6MSwicGVwcGVyaS5iYXNldXJsIjoiaHR0cHM6Ly9wYXBpLnN0YWdpbmcucGVwcGVyaS5jb20vVjEuMCIsIm5hbWUiOiJkYW5pZWwgZGF2aWRvZmYiLCJzY29wZSI6WyJwZXBwZXJpLmFwaW50Iiwib2ZmbGluZV9hY2Nlc3MiXSwiYW1yIjpbInB3ZCJdfQ.IqbwUVUWFb2xeJNkFvSPqaLYYGpDdYDiOgVjB7lAJI7uOVfJhqPWkAKMhke6-HJHSBW5_LzM08EaTGkHX_r1fl0uQyx5bLkkpbKLnYtfP0cLDhdMZ-wVNJCT5-f02tTZ_VFE_lfdaALWY0Hhq4JokS6CqtTW5tJAG7wDuhex8l99_tYOzIpO4idscZqTaOVy4DUFJON6HktSfw2Nw-WV7ThBlMyLKQJDR6LHqAwts04NmTHw0AMoCcrYCR0EYzo3Sf9SI7NsbOiV5zaiyd_qeMJODN3jsnq_rduBXJTqAmUvLk0x3wDc4eAI_FDuvMgWH-QUo9u8zoCnYyoa1bP1BQ";
  constructor(
    private httpService: PepHttpService,
    private addonService: PepAddonService,
    private dialogService: PepDialogService
  ) {
    //sessionStorage.setItem("idp_token", this.idpToken);
  }
 
  getAddonServerAPI(
    fileName: string,
    functionName: string,
    options: any
  ) {
    debugger;
    return this.addonService.getAddonApiCall(
      '7e15d4cc-55a7-4128-a9fe-0e877ba90069',
      fileName,
      functionName,
      options
    );
  }
 
  postAddonServerAPI(
    fileName: string,
    functionName: string,
    body: any,
    options: any
  ) {
    return this.addonService.postAddonApiCall(
      '7e15d4cc-55a7-4128-a9fe-0e877ba90069',
      fileName,
      functionName,
      body,
      options
    );
  }
 
  openDialog(title: string, content: string, callback?: any) {
    const actionButton: PepDialogActionButton = {
      title: "OK",
      className: "",
      callback: callback,
    };
 
    const dialogData = new PepDialogData({
      title: title,
      content: content,
      actionButtons: [actionButton],
      actionsType: "custom",
    });
    this.dialogService
      .openDefaultDialog(dialogData)
      .afterClosed()
      .subscribe((callback) => {
        if (callback) {
          callback();
        }
      });
  }
 
  // getFromAPI(apiObject, successFunc, errorFunc) {
  //   //this.addonService.setShowLoading(true);
  //   const endpoint = apiObject.ListType === "all" ? "addons" : "updates";
  //   // // --- Work live in sandbox upload api.js file to plugin folder
  //   // const url = `/addons/api/${apiObject.UUID}/api/${endpoint}`;
  //   // this.addonService.httpGetApiCall(url, successFunc, errorFunc);
 
  //   //--- Work localhost
  //   const url = `http://localhost:4400/api/${endpoint}`;
  //   // this.httpService.getHttpCall(url, searchObject, { 'headers': {'Authorization': 'Bearer ' + this.addonService.getUserToken() }}).subscribe(
  //   //     res => successFunc(res), error => errorFunc(error), () => this.addonService.setShowLoading(false)
  //   // );
  //   this.httpService.getHttpCall("");
  // }
 
  // postToAPI(endpoint) {
  //   const url = `http://localhost:4400/api/${endpoint}`;
  //   this.post(url);
  // }
 
  post(url: string) {
    this.httpService.postHttpCall(url, null).subscribe((result) => {});
  }
 
  getPapiCall(url: string) {
    return this.httpService.getPapiApiCall(url);
  }
 
  postPapiCall(url: string, body: any) {
    return this.httpService.postPapiApiCall(url, body);
  }
}