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


    protected urlLoadedObserver?: CoreEventObserver;
    protected messageObserver?: CoreEventObserver;
    protected browserClosedObserver?: CoreEventObserver;
    protected obsProfileRefreshed?: CoreEventObserver;

    protected userId!: number;
    protected site!: CoreSite;

    constructor() {
        this.logoutLabel = CoreLoginHelper.getLogoutLabel();
        try {
            this.site = CoreSites.getRequiredCurrentSite();
            this.userId = CoreSites.getCurrentSiteUserId();
        } catch (error) {
            CoreDomUtils.showErrorModal(error);
            CoreNavigator.back();

            return;
        }

        this.obsProfileRefreshed = CoreEvents.on(USER_PROFILE_REFRESHED, (data) => {
            if (!this.user || !data.user) {
                return;
            }

            this.user.email = data.user.email;
            this.user.address = CoreUserHelper.formatAddress('', data.user.city, data.user.country);
            this.user.username = data.user.username
        }, CoreSites.getCurrentSiteId());
    }

    /**
     * Show help modal.
     */
    showHelp(): void {
        CoreUserSupport.showHelp(
            Translate.instant('core.login.changepasswordhelp'),
            Translate.instant('core.login.changepasswordsupportsubject'),
        );
    }

    /**
     * Open the change password page in a browser.
     */
    openChangePasswordPage(): void {
        CoreLoginHelper.openInAppForEdit(
            CoreSites.getCurrentSiteId(),
            '/login/change_password.php',
            undefined,
            true,
        );
        this.changingPassword = true;
        this.detectPasswordChanged();
    }

/** check if the password matches
 * and is strong
 */


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

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar) {
      CoreUserSupport.showAlert(
        Translate.instant('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.')
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
                Translate.instant('Password Cannot be Empty'),
            );
            return;
        }

        if (!this.isPasswordStrong(this.newPassword)) {
            return;
        }

        if (this.newPassword !== this.confirmPassword) {
            CoreUserSupport.showAlert(
                Translate.instant('Passwords do not match.')
            );
            this.newPassword = '';
            this.confirmPassword = '';
            return;
        }

        // Implement your password change logic here
        // You can use this.newPassword and this.confirmPassword to get user input
        // Send the data to the server for password change
        const site = CoreSites.getCurrentSite();
        const username = site ? site.getInfo()?.username : undefined;
        console.log('New Password:', this.newPassword);
        console.log('Confirm Password:', this.confirmPassword);

        try {
            const result = await CoreLoginHelper.resetPasswordClicked(username ?? "rs222", this.site.siteUrl, this.userId, this.newPassword, this.confirmPassword);
            console.log('Site url:', this.site.siteUrl);
            console.log('User ID:', this.userId);
            console.log('username:', username);
            console.log('result', result);

            if (result.success === "true") {
                CoreNavigator.navigateToSiteHome();
            } else {
                // Show an error message based on the result.message property
                CoreUserSupport.showAlert(result.message);
            }
        } catch (error) {
            console.error('An error occurred:', error);

            //
        }
    }



    /**
     * Logout the user.
     */
    logout(): void {
        CoreSites.logout();
        this.changingPassword = false;
    }

    /**
     * Try to detect if the user changed password in browser.
     */
    detectPasswordChanged(): void {
        if (this.urlLoadedObserver) {
            // Already listening (shouldn't happen).
            return;
        }

        this.urlLoadedObserver = CoreEvents.on(CoreEvents.IAB_LOAD_STOP, (event) => {
            if (event.url.match(/\/login\/change_password\.php.*return=1/)) {
                // Password has changed, close the IAB now.
                CoreUtils.closeInAppBrowser();
                this.login();

                return;
            }

            if (!event.url.match(/\/login\/change_password\.php/)) {
                return;
            }

            // Use a script to check if the user changed the password, in some platforms we cannot tell using the URL.
            CoreUtils.getInAppBrowserInstance()?.executeScript({
                code: `
                    if (
                        document.querySelector('input[type="password"]') === null &&
                        document.querySelector('button[type="submit"]') !== null
                    ) {
                        webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify({ passwordChanged: true }));
                    }
                `,
            });
        });

        this.messageObserver = CoreEvents.on(CoreEvents.IAB_MESSAGE, (data) => {
            if (data.passwordChanged) {
                CoreUtils.closeInAppBrowser();
                this.login();
            }
        });

        this.browserClosedObserver = CoreEvents.on(CoreEvents.IAB_EXIT, () => {
            this.urlLoadedObserver?.off();
            this.messageObserver?.off();
            this.browserClosedObserver?.off();

            delete this.urlLoadedObserver;
            delete this.messageObserver;
            delete this.browserClosedObserver;
        });
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
