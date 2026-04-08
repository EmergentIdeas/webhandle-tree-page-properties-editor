# @webhandle/tree-page-properties-editor

## Install

```bash
npm install @webhandle/tree-page-properties-editor
```


## Initialize

```js
import setupPageEditor from "@webhandle/tree-page-properties-editor/initialize-webhandle-component.mjs"
let managerPageEditor = await setupPageEditor(webhandle)
```

## Configure

```json
{
	"@webhandle/tree-page-properties-editor": {
		"publicFilesPrefix": "@webhandle/tree-page-properties-editor/files"
		, "alwaysProvideResources": false
	}
}
```


## Usage

To include it on a page:

```html
__::@webhandle/tree-page-properties-editor/create-page-editor__
```