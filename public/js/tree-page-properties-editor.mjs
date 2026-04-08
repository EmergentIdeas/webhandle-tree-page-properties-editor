import { View } from '@webhandle/backbone-view'
import { KalpaTreeView } from "kalpa-tree-on-page/kalpa-tree-view"
import { Dialog, FormAnswerDialog, formValueInjector, gatherFormData } from "@webhandle/dialog"
import { ImageInput, FileInput } from "@webhandle/image-input"
import { tripartite } from "tripartite"

let starterData = {
	menus: [
		{
			name: "primary"
			, nodes: [
				{
					"id": 0,
					"label": "main",
				}
			]
		}
	]
}


let sinkMenus
let sinkPages
let sinkFiles
let pageNodes
let siteEditorBridge
try {
	let mod = await import("@webhandle/site-editor-bridge")
	sinkMenus = mod.siteEditorBridge.resourceTypes.menus
	sinkPages = mod.siteEditorBridge.resourceTypes.pages
	sinkFiles = mod.siteEditorBridge.resourceTypes.files
	siteEditorBridge = mod.siteEditorBridge

}
catch (e) {
	console.error(e)
	// well... This may keep it from working, but it doesn't need this if the sink
	// is passed with the constructor
}

export class TreePagePropertiesEditor extends View {
	currentMenu = "primary"
	curMaxId = 0
	data
	fileName = 'mainset.json'
	detailsTemplateName = '@webhandle/tree-page-properties-editor/menu-item-details'
	frameTemplateName = '@webhandle/tree-page-properties-editor/frame'
	forceWebSafeNames = true

	preinitialize(options) {
		this.events = Object.assign({}, {
			'click .delete-item': 'deleteItem'
			, 'click .create-item': 'createItem'
			, 'click .rename-item': 'renameItem'
			, 'click .create-folder': 'createFolder'
			, 'click .save-page': 'savePage'
			, 'click .edit-raw-page': 'editRawPage'
			, 'keyup .node-view input': 'updateNodeForForm'
			, 'keyup .node-view textarea': 'updateNodeForForm'
			, 'change .node-view input': 'updateNodeForForm'
			, 'change .node-view textarea': 'updateNodeForForm'
			, 'change .node-view select': 'updateNodeForForm'
		}, options.events)
		options.events = this.events
	}

	updateNodeForForm(evt, selected) {
		let nodeView = this.getNodeView()
		let data = gatherFormData(nodeView)
		delete data.attrName
		delete data.attrValue


		let names = [...nodeView.querySelectorAll('input[name="attrName"]')]
		let values = [...nodeView.querySelectorAll('input[name="attrValue"]')]
		data.attributes = {}
		while (names.length > 0 && values.length > 0) {
			let name = names.shift()
			let value = values.shift()
			if (!name.value || !value.value) {
				continue
			}
			data.attributes[name.value] = value.value
		}

		this.tree.tree.edit(data)
	}

	findMaxId() {
		let max = pageNodes.reduce((max, node) => {
			if (node.id > max) {
				max = node.id
			}
			return max
		}, 0)
		return max
	}

	createNewId() {
		return ++this.curMaxId
	}

	watchInputForSlug(input) {
		if(this.forceWebSafeNames) {
			input.addEventListener('input', (evt) => {
				setTimeout(() => {
					this.fixInputForSlug(input)
				})
			})
		}
	}

	fixInputForSlug(input) {
		input.value = this.fixValueForSlug(input.value)
	}

	fixValueForSlug(value) {
		value ||= ''
		return value.toLowerCase().replaceAll(/\s/gi, '-').replaceAll(/['"\[\]!@#$%^&*()=+{}<>,.?\/\\|`~:;]/gi, '-')
	}




	async deleteItem(evt, selected) {
		let curItem = this.tree.tree.selected()
		let parent = this.tree.tree.parent(curItem)
		if (!parent) {
			alert('Can not delete the "pages" folder.')
		}
		else {
			let answer
			if (curItem.type === 'container') {
				answer = confirm('Are you sure you want to delete this folder and all its pages?')
			}
			else {
				answer = confirm('Are you sure you want to delete this page?')
			}
			if (answer) {
				await siteEditorBridge.services.pages.rm(curItem.path)
				this.tree.tree.removeNode(curItem)
				this.tree.tree.select(parent.id)

			}
		}
	}
	
	async editRawPage(evt, selected) {
		let curItem = this.tree.tree.selected()
		try {
			let content = (await sinkPages.read(curItem.contentFilePath)).toString()
			let html = '<div class="ei-form-styles"><label>Page source: <textarea type="text" name="pageSource" style="height: 80vh" ></textarea></label></div>'

			let dialog = new FormAnswerDialog({
				body: html
				, afterOpen: () => {
					let textarea = dialog.el.querySelector('textarea[name="pageSource"]')
					textarea.value = content
				}
				, styles: {
					width: "90%"
				}
			})
			let answer = await dialog.open()
			if(answer && answer.pageSource) {
				await sinkPages.write(curItem.contentFilePath, answer.pageSource)
			}
		}
		catch(e) {
			alert('Could not open the file.')

		}

	}
	
	getParentOfNewItem() {
		let curItem = this.tree.tree.selected()
		let parentId
		let parentPath
		let parent

		if (curItem && curItem.parentId) {
			// a normal node
			if (curItem.type === 'leaf') {
				parentId = curItem.parentId
				parent = this.tree.tree.get(parentId)
				parentPath = parent.path + '/'
			}
			else {
				parentId = curItem.id
				parent = curItem
				parentPath = curItem.path + '/'
			}
		}
		else {
			// the root node
			parentId = 0
			parentPath = ''
			parent = curItem
		}

		return {
			parent
			, parentId
			, parentPath
		}
	}
	
	async createFolder(evt, selected) {
		let {parent, parentId, parentPath} = this.getParentOfNewItem()
		let curItem = this.tree.tree.selected()
		if (curItem.type === 'leaf') {
			curItem = parent
		}


		let html = '<div class="ei-form-styles"><label>Folder name: <br>(name only, no extension, lower case, numbers, dash, underscore)<input type="text" name="folderName" /></label></div>'

		let dialog = new FormAnswerDialog({
			body: html
			, afterOpen: () => {
				let folderName = dialog.el.querySelector('input[name="folderName"]')
				this.watchInputForSlug(folderName)
			}
		})
		let answer = await dialog.open()
		let folderName = answer.folderName.trim()
		if (folderName) {
			let path = curItem.path + (curItem.path ? '/' : '') + folderName

			await sinkPages.mkdir(path)

			let nodes = await siteEditorBridge.services.pages.createPageTreeOptions()
			let node = nodes.find(node => node.path === path)

			let newId = this.createNewId()
			node.id = newId
			node.parentId = curItem.id

			this.setIconForNode(node)

			this.tree.tree.options.stream.emit('data', node)
			this.tree.tree.select(newId)
		}




	}

	async savePage(evt, selected) {
		let curItem = this.tree.tree.selected()
		let form = this.getNodeView()
		let metadata = gatherFormData(form)
		delete metadata.id
		
		let storedMetadata = {}
		try {
			storedMetadata = JSON.parse(await sinkPages.read(node.metaFilePath))
		}
		catch(e) {}
		Object.assign(storedMetadata, metadata)
		await sinkPages.write(curItem.metaFilePath, JSON.stringify(storedMetadata, null, '\t'))
	}

	async createItem(evt, selected) {
		let {parent, parentId, parentPath} = this.getParentOfNewItem()


		let html = '<div class="ei-form-styles"><label>Page name: <br>(name only, no extension, lower case, numbers, dash, underscore)<input type="text" name="pageName" /></label>'

		html += `<label>Page template:
		<select name="pageTemplate">
		`
		let paths = this.tree.serializeTree().filter(node => node.type === 'leaf').map(node => node.path)
		paths.sort()
		for (let path of paths) {
			html += `<option>${path}</option>`
		}

		html += '</select></label></div>'

		let dialog = new FormAnswerDialog({
			body: html
			, afterOpen: () => {
				let pageName = dialog.el.querySelector('input[name="pageName"]')
				this.watchInputForSlug(pageName)
			}
		})
		let answer = await dialog.open()
		let pageName = answer.pageName.trim()
		if (pageName) {
			let path = parentPath + pageName
			await siteEditorBridge.services.pages.cp(answer.pageTemplate, path)
			let nodes = await siteEditorBridge.services.pages.createPageTreeOptions()
			let node = nodes.find(node => node.path === path)

			let newId = this.createNewId()
			node.id = newId
			node.parentId = parentId

			this.setIconForNode(node)

			this.tree.tree.options.stream.emit('data', node)
			this.tree.tree.select(newId)

		}


	}

	async renameItem(evt, selected) {
		let {parent, parentId, parentPath} = this.getParentOfNewItem()
		let curItem = this.tree.tree.selected()
		if (curItem.type === 'container') {
			return
		}


		let html = '<div class="ei-form-styles"><label>Page name: <br>(name only, no extension, lower case, numbers, dash, underscore)<input type="text" name="pageName" /></label></div>'

		let dialog = new FormAnswerDialog({
			body: html
			, afterOpen: () => {
				let pageName = dialog.el.querySelector('input[name="pageName"]')
				pageName.value = curItem.label
				this.watchInputForSlug(pageName)
			}
		})
		let answer = await dialog.open()
		let pageName = answer.pageName.trim()
		if (pageName) {
			if(pageName === curItem.label) {
				return
			}
			let path = parentPath + pageName
			await siteEditorBridge.services.pages.cp(curItem.path, path)

			let nodes = await siteEditorBridge.services.pages.createPageTreeOptions()
			let node = nodes.find(node => node.path === path)

			let newId = this.createNewId()
			node.id = newId
			node.parentId = parentId

			this.setIconForNode(node)

			this.tree.tree.options.stream.emit('data', node)
			this.tree.tree.select(newId)
			
			await siteEditorBridge.services.pages.rm(curItem.path)
			this.tree.tree.removeNode(curItem)
			

			this.tree.tree.select(node.id)
		}


	}

	populateTreeForMenu() {
		for (let node of pageNodes) {
			this.tree.tree.options.stream.emit('data', node)
		}
		this.curMaxId = this.findMaxId()
		// You'd think we're setting this too many times, but it doesn't work otherwise
		let root = this.tree.tree.get()
		this.tree.tree.select(root)
		this.focusNode(this.tree.tree.get(0))
		this.tree.tree.select(0)
	}

	async loadData() {
		pageNodes = await siteEditorBridge.services.pages.createPageTreeOptions()
		for (let node of pageNodes) {
			this.setIconForNode(node)
		}
		this.data = pageNodes
	}

	setIconForNode(node) {
		if (node.type === 'container') {
			node.icon = 'folder'
		}
		else {
			node.icon = 'page'
		}

	}

	async render() {
		await this.loadData()

		// this.currentMenu = this.data.menus[0].name
		if (this.frameTemplateName) {
			let frameTemplate = await tripartite.loadTemplateAsync(this.frameTemplateName)
			this.el.innerHTML = frameTemplate()
		}

		let holder = this.el.querySelector('.treebox')
		let tree = this.tree = new KalpaTreeView({
			treeOptions: {
				movable: function (node) {
					if (node.type === 'container') {
						return false
					}
					return true
				}
				, droppable: function (d, parent) {
					return (parent.type === 'container') ? true : false
				}
				, accessors: {
					icon: 'icon'
				}
			}
		})
		await tree.render()
		tree.appendTo(holder)

		tree.tree.editable()
		tree.emitter.on('select', (data) => {
			this.focusNode(data.node)
		})

		tree.tree.on('move', this.moveNode.bind(this))

		// this.setupMenuOptions()
		this.populateTreeForMenu()
	}
	
	async moveNode(mvNode, newParent, previousParent, newIndex, prevIndex) {
		let oldPath = mvNode.path
		let newPath = newParent.path + (newParent.path ? '/' : '') + mvNode.name
		if(oldPath == newPath) {
			return
		}
		
		await siteEditorBridge.services.pages.mv(oldPath, newPath)
		let nodes = await siteEditorBridge.services.pages.createPageTreeOptions()
		let node = nodes.find(node => node.path === newPath)

		let newId = this.createNewId()
		node.id = newId
		node.parentId = newParent.id

		this.setIconForNode(node)

		this.tree.tree.options.stream.emit('data', node)
		this.tree.tree.removeNode(mvNode)
		this.tree.tree.select(newId)
	}

	async getFormHTML(node) {
		let details = await tripartite.loadTemplateAsync(this.detailsTemplateName)
		return details(node)
	}

	async updateNodeView(node) {
		let nodeView = this.getNodeView()
		let metadata = {}
		try {
			metadata = JSON.parse(await sinkPages.read(node.metaFilePath))

		}
		catch(e) {}
		nodeView.innerHTML = formValueInjector(nodeView.innerHTML, metadata)

		let inputs = nodeView.querySelectorAll('input[data-view-component="@webhandle/image-input"]')
		for (let input of inputs) {
			let img = new ImageInput({
				input: input
				, sink: sinkFiles
				, imagesOnly: true
			})
			img.render()
			img.appendTo(input.parentElement)
		}

		inputs = nodeView.querySelectorAll('input[data-view-component="@webhandle/file-input"]')
		for (let input of inputs) {
			let img = new FileInput({
				input: input
				, sink: sinkFiles
				, imagesOnly: false
			})
			img.render()
			img.appendTo(input.parentElement)
		}

		let names = [...nodeView.querySelectorAll('input[name="attrName"]')]
		let values = [...nodeView.querySelectorAll('input[name="attrValue"]')]
	}

	getNodeView() {
		let nodeView = this.el.querySelector('.node-view')
		return nodeView
	}

	async focusNode(node) {
		let nodeView = this.getNodeView()
		if (node.parentId === undefined || node.parentId === null) {
			nodeView.innerHTML = '<p>Choose a page from the tree to edit its properties.</p>'
		}
		else if(node.type === 'container') {
			nodeView.innerHTML = '<p>Choose a page from the tree to edit its properties.</p>'
			
		}
		else {
			let formHtml = await this.getFormHTML(node)
			nodeView.innerHTML = formHtml
			this.updateNodeView(node)

		}
	}

}