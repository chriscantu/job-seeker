-- Strip pandoc-generated heading bookmarks from the rendered docx.
-- Pandoc auto-emits <w:bookmarkStart>/<w:bookmarkEnd> for every heading to
-- support TOC/cross-ref. The resume has neither, so the bookmarks are pure
-- noise (and visible in some Word readers as gray brackets). Clearing each
-- heading's identifier suppresses the bookmark emission.
function Header(el)
  el.identifier = ''
  el.attributes = {}
  return el
end
