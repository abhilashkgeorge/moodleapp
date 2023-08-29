// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Component, OnDestroy } from '@angular/core';

import { CoreSites } from '@services/sites';
import { CoreLoginHelper } from '@features/login/services/login-helper';
import { Translate } from '@singletons';
import { CoreNavigator } from '@services/navigator';
import { CoreEventObserver, CoreEvents } from '@singletons/events';
import { CoreUtils } from '@services/utils/utils';
import { CoreUserSupport } from '@features/user/services/support';
import { CoreSite } from '@classes/site';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreUserHelper } from '@features/user/services/user-helper';

import {
    CoreUser,
    CoreUserProfile,
    USER_PROFILE_PICTURE_UPDATED,
    USER_PROFILE_REFRESHED,
    USER_PROFILE_SERVER_TIMEZONE,
} from '@features/user/services/user';

/**
 * Page that shows instructions to change the password.
 */
@Component({
    selector: 'page-core-login-change-password',
    templateUrl: 'change-password.html',
    styleUrls: ['change-password.scss']
})
export class ChangePasswordPage implements OnDestroy {

    changingPassword = false;
    logoutLabel: string;
    newPassword: string = '';
    confirmPassword: string = '';
    user?: CoreUserProfile;
    username: string = '';
    password: string = ''


    protected urlLoadedObserver?: CoreEventObserver;
    protected messageObserver?: CoreEventObserver;
    protected browserClosedObserver?: CoreEventObserver;
    protected obsProfileRefreshed?: CoreEventObserver;

    protected userId!: number;
    protected site!: CoreSite;

    constructor() {
        this.logoutLabel = CoreLoginHelper.getLogoutLabel();
        const site = CoreSites.getCurrentSite();
        try {
            this.site = CoreSites.getRequiredCurrentSite();
            this.userId = CoreSites.getCurrentSiteUserId();
            this.username = site ? site.getInfo()?.username ?? "": "";
        } catch (error) {
            CoreDomUtils.showErrorModal(error);
            CoreNavigator.back();

            return;
        }
    }
/** check if the password matches
 * and is strong
 */
isPasswordValid(password: string): boolean {
    const minLength = 7;
    return password.length >= minLength;
}

hasLowerCase(password: string): boolean {
    const lowercasePattern = /[a-z]/;
    return lowercasePattern.test(password);
}

hasUpperCase(password: string): boolean {
    const uppercasePattern = /[A-Z]/;
    return uppercasePattern.test(password);
}

hasSpecialCharacter(password: string): boolean {
    const specialCharPattern = /[!@#$%^&*()_+{}\[\]:;<>,.?~\-\/\\]/;
    return specialCharPattern.test(password);
}
hasDigit(password: string): boolean {
    const digitPattern = /[0-9]/;
    return digitPattern.test(password);
}



  isFormValid(): boolean {
    return (
      this.newPassword.trim() !== '' &&
      this.confirmPassword.trim() !== ''
    );
  }

  isPasswordStrong(password: string): boolean {
    // Check for at least one uppercase letter, one lowercase letter, one number, and one special character.
    const uppercasePattern = /[A-Z]/;
    const lowercasePattern = /[a-z]/;
    const numberPattern = /[0-9]/;
    const specialCharPattern = /[!@#$%^&*()_+{}\[\]:;<>,.?~\-\/\\]/;

    const hasUppercase = uppercasePattern.test(password);
    const hasLowercase = lowercasePattern.test(password);
    const hasNumber = numberPattern.test(password);
    const hasSpecialChar = specialCharPattern.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar || password.length < 8) {
      CoreUserSupport.showAlert(
        Translate.instant('Password Requirements Not Satisified'), "Try Again"
      );
      return false;
    }

    return true;
  }

    /**
     * Login the user.
     */
    async login(): Promise<void> {
        if (!this.isFormValid()) {
            CoreUserSupport.showAlert(
                Translate.instant('Password Cannot be Empty'), "Error"
            );
            return;
        }

        if (!this.isPasswordStrong(this.newPassword)) {
            return;
        }

        if (this.newPassword !== this.confirmPassword) {
            CoreUserSupport.showAlert(
                Translate.instant('Passwords do not match.'), "Try Again"
            );
            this.newPassword = '';
            this.confirmPassword = '';
            return;
        }
        // const site = CoreSites.getCurrentSite();
        // const username = site ? site.getInfo()?.username : undefined;


        const modal = await CoreDomUtils.showModalLoading();
        try {
            const data = await CoreSites.getUserToken("https://lms.haldiram.com/", this.username, this.password);
           // const result = await CoreLoginHelper.resetPasswordClicked(username, this.site.siteUrl, this.userId, this.newPassword, this.confirmPassword);
           const changePasswordUrl = `https://lms.haldiram.com/webservice/rest/server.php?moodlewsrestformat=json&wstoken=${data.token}&wsfunction=local_webservice_change_password&userid=${this.userId}&newpassword=${this.newPassword}&confirmpassword=${this.confirmPassword}`;
           const response = await this.changePasswordDirectly(changePasswordUrl);
           if (response.success === "true") {
                CoreUserSupport.showAlert(response.message, "Success")
            // Clear input fields after successful password change.
                this.password = '';
                this.newPassword = '';
                this.confirmPassword = '';
                CoreNavigator.navigateToSiteHome();
           } else {
            CoreUserSupport.showAlert(response.message, "Failure")
           }
        } catch (error) {
            CoreUserSupport.showAlert("Invalid Credentials", "Try Again")
        } finally {
            modal.dismiss()
        }
    }

    async changePasswordDirectly(url: string): Promise<{ success: string, message: string }> {

        try {
            const response = await fetch(url, {
                method: 'POST', // Or 'POST' depending on your API
                // You can add headers if needed, e.g., Authorization header
            });

            const data = await response.json();

            // Assuming your API response contains a "success" property and a "message" property
            const success = data.success;
            const message = data.message;

            return { success, message };
        } catch (error) {
            CoreUserSupport.showAlert(
                "An Error Occured:" + error.message, "Error"
            )
            return { success: "false", message: 'An error occurred while changing password.' };
        }
    }


    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        this.urlLoadedObserver?.off();
        this.messageObserver?.off();
        this.browserClosedObserver?.off();
    }

}
