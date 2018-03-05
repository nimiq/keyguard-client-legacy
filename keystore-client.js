import { RPC } from '/libraries/boruca-messaging/src/boruca.js';

export default class KeyStoreClient {
	static async create(src, needUiCallback, usePopup = true) {
		const client = new KeyStoreClient(src, needUiCallback, usePopup);
		const embeddedApi = await KeyStoreClient._getApi(client.$iframe.contentWindow)
		return client.wrapApi(embeddedApi);
	}

    /**
	 * @private
	 *
     * @param {function} needUiCallback
     * @param {any} api
     * @param {boolean} usePopup
     */
	constructor(src, needUiCallback, usePopup = true) {
		this._keystoreSrc = src;
		this.popup = usePopup;
		this.$iframe = this._createIframe();
	    this.needUiCallback = needUiCallback || this._defaultUi.bind(this);
	    this.publicApi = {};
	}

	wrapApi(embeddedApi) {
 		this.embeddedApi = embeddedApi;
        for (const methodName in this.embeddedApi) {
			console.log(methodName);
            if (this.embeddedApi.hasOwnProperty(methodName)) {
                let method = this._proxyMethod(methodName);
                method.secure = this._proxySecureMethod(methodName);
                this.publicApi[methodName] = method;
            }
        }
		return this.publicApi;
	}

	/** @param {string} methodName
	 *
	 * @returns {function} The proxy method for methodName
	 * */
	_proxyMethod(methodName) {
		return async () => {
			const method = this.embeddedApi[methodName];

			if (this._willRequireSecure(methodName, arguments))
				return method.secure.call(arguments);

			try {
				return await method.call(arguments);
			}
			catch (error) {
				if (error === 'need-ui') {
					const confirmed = await this.needUiCallback(methodName);
					if (confirmed) {
							return method.secure.call(arguments);
					}
					else throw 'Denied by user';
				}
				else throw error;
			}
		}
	}

	_proxySecureMethod() {
		return async () => {
			if (this.popup) { // window.open
				const apiWindow = window.open(this._keystoreSrc, "keystore"),
						  secureApi = await this._getApi(apiWindow),
						  result = await secureApi[methodName].call(arguments);
				apiWindow.close();
				return result;
			} else { // top level navigation
				const returnTo = encodeURIComponent(window.location);
				//window.location = `${ KeyStoreClient.KEYSTORE_URL }?returnTo=${ returnTo }`;
				throw "not implemented";
			}
		}
	}

	_willRequireSecure(method, args) {
		return false;
	}

	_defaultUi(methodName) {
		return new Promise((resolve, reject) => { resolve(window.confirm("You will be forwarded to securely confirm this action.")); });
	}

	static async _getApi(origin) {
		return await RPC.Client(origin, 'KeystoreApi');
	}

	_createIframe(src) {
		const $iframe = document.createElement('iframe');
		$iframe.style.display = 'none';
		$iframe.src = this._keystoreSrc;
		$iframe.name = 'keystore';
		document.body.appendChild($iframe);
		return $iframe;
	}
}