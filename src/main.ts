import { ItemView, Plugin, WorkspaceLeaf } from "obsidian";
import { around } from "monkey-around";
import { BetterLockSettings, DEFAULT_SETTINGS } from "./interface";
import { BetterLockSettingsTab } from "./settings";
import i18next from "i18next";
import { resources, translationLanguage } from "./i18n/i18next";


export default class BetterLock extends Plugin {
	//eslint-disable-next-line @typescript-eslint/no-explicit-any
	active_monkeys: Record<string, any> = {};
	//eslint-disable-next-line @typescript-eslint/no-explicit-any
	originalFunction: Record<string, any> = {};
	saved: boolean;
	settings: BetterLockSettings;

	removeHandle(leaf: WorkspaceLeaf) {
		//@ts-ignore
		const canvas = leaf.view.canvas;
		const reset = () => {return;};
		if (this.settings.select) {
			canvas.handleSelectionDrag = reset;
			canvas.handleDragToSelect = reset;
		}
		if (this.settings.zoom) {
			canvas.zoomBy = reset;
		}
		if (this.settings.createFile) {
			canvas.createTextNode = reset;
			canvas.createFileNode = reset;
			canvas.createFileNodes = reset;
			canvas.dragTempNode = reset;
		}
	}

	restoreHandle(leaf: WorkspaceLeaf) {
		//@ts-ignore
		const canvas = leaf.view.canvas;
		if (this.settings.select) {
			canvas.handleSelectionDrag = this.originalFunction.handleSelectionDrag;
			canvas.handleDragToSelect = this.originalFunction.handleDragToSelect;
		}
		if (this.settings.zoom) {
			canvas.zoomBy = this.originalFunction.zoomBy;
		}
		if (this.settings.createFile) {
			canvas.createFileNode = this.originalFunction.createFileNode;
			canvas.createTextNode = this.originalFunction.createTextNode;
			canvas.createFileNodes = this.originalFunction.createFileNodes;
			canvas.dragTempNode = this.originalFunction.dragTempNode;
		}
	}

	async saveHandle(leaf: WorkspaceLeaf) {
		//@ts-ignore
		const canvas = leaf.view.canvas;
		const isAlreadyReturn = Object.values(this.originalFunction).some((value) => value.toString().replaceAll(" ", "").replaceAll("\n", "") === "()=>{return;}");
		if (!this.saved && !isAlreadyReturn) {
			console.log("Saving original function");
			if (this.settings.select) {
				this.originalFunction.handleSelectionDrag = canvas.handleSelectionDrag;
				this.originalFunction.handleDragToSelect = canvas.handleDragToSelect;
			}
			if (this.settings.zoom) {
				this.originalFunction.zoomBy = canvas.zoomBy;
			}
			if (this.settings.createFile) {
				this.originalFunction.createFileNode = canvas.createFileNode;
				this.originalFunction.createTextNode = canvas.createTextNode;
				this.originalFunction.createFileNodes = canvas.createFileNodes;
				this.originalFunction.dragTempNode = canvas.dragTempNode;
			}
			this.saved = true;
		}

	}

	removeCamera(leaf: WorkspaceLeaf) {
		//@ts-ignore
		const canvas = leaf.view.canvas;
		try {
			return around(canvas, {
				setReadonly: (oldMethod) => {
					return async (read_only: boolean) => {
						try {
							oldMethod?.apply(canvas, [read_only]);
							if (read_only) {
								console.log("Camera locked");
								await this.saveHandle(leaf);
								this.removeHandle(leaf);
							} else {
								console.log("Camera unlocked");
								this.restoreHandle(leaf);
							}
						} catch (e) {
							//ignore
						}
					};
				}
			});
		} catch (e) {
			console.log(e);
		}
	}

	async onload() {
		console.log(
			`CameraLockCanvas v.${this.manifest.version} loaded.`
		);

		i18next.init({
			lng: translationLanguage,
			fallbackLng: "en",
			resources,
			returnNull: false,
		});


		await this.loadSettings();
		this.addSettingTab(new BetterLockSettingsTab(this.app, this));
		
		this.registerEvent(this.app.workspace.on("file-open", async (file) => {
			if (!file) {
				for (const monkey of Object.values(this.active_monkeys)) {
					monkey();
				}
				this.active_monkeys = {};
				return;
			}
			if (file.extension !== "canvas") {
				return;
			}
			//get active leaf
			const activeView = this.app.workspace.getActiveViewOfType(ItemView);
			if (activeView && activeView?.getViewType() === "canvas") {
				//@ts-ignore
				const id = activeView.leaf.id;
				//@ts-ignore
				const canvas = activeView.leaf.view.canvas;
				this.active_monkeys[id] = this.removeCamera(activeView.leaf);
				if (canvas.readonly) {
					await this.saveHandle(activeView.leaf);
					this.removeHandle(activeView.leaf);
				} 
			}
		}));

		
		
	}
	onunload() {
		console.log(
			`CameraLockCanvas v.${this.manifest.version} unloaded.`
		);
		for (const monkey of Object.values(this.active_monkeys)) {
			monkey();
		}
		this.active_monkeys = {};
	}
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
	
}
