import { enUS } from '@draggable/formeo-languages'
import mi18n from '@draggable/i18n'

const locale = 'en-US'
mi18n.addLanguage(locale, enUS)
mi18n.setCurrent(locale)

export const defaults = {
  get editor() {
    return {
      stickyControls: false,
      allowEdit: true,
      dataType: 'json',
      debug: false,
      sessionStorage: false,
      editorContainer: null, // element or selector to attach editor to
      svgSprite: null, // null = use bundled sprite, or provide custom URL
      style: null, // null = CSS should be imported directly in your project (e.g., import 'formeo/dist/formeo.min.css')
      // Alternatively, you can provide a local path: style: './dist/formeo.min.css'
      iconFont: null, // 'glyphicons' || 'font-awesome' || 'fontello'
      config: {}, // stages, rows, columns, fields
      events: {},
      actions: {},
      controls: {},
      i18n: {
        location: null, // null = use bundled language files from @draggable/formeo-languages
      },
      onLoad: () => {},
    }
  },
}
