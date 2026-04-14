# Prerequisites:
#   Node.js (v18 or later) and npm must be installed.
#   $ node --version && npm --version
#

NPX := npx
NPM := npm

# Port for the test WebDAV server
SERVE_PORT := 18080

.PHONY: default
default: build

# ============================================================
# Targets
# ============================================================

.PHONY: deps
deps: node_modules

node_modules: package.json package-lock.json
	$(NPM) ci
	@touch $@

.PHONY: build
build: node_modules
	$(NPM) run build

.PHONY: test
test: node_modules
	$(NPM) test

.PHONY: audit
audit: node_modules
	$(NPM) audit

.PHONY: lint
lint: node_modules
	$(NPX) tsc --noEmit

## Start test WebDAV server
## Deploys dist/davpage.html to the WebDAV root if it exists.
.PHONY: serve
serve: node_modules
	$(NPM) run serve -- $(SERVE_PORT)

## Watch source files and rebuild on changes
.PHONY: dev
dev: node_modules
	$(NPM) run dev

.PHONY: clean
clean:
	rm -rf dist tmp

.PHONY: distclean
distclean: clean
	rm -rf node_modules

.PHONY: help
help:
	@echo "Available targets:"
	@echo ""
	@echo "  make deps       Install dependencies (first time only)"
	@echo "  make build      Build (generates dist/davpage.html)  [default]"
	@echo "  make test       Run tests"
	@echo "  make lint       Static type checking (TypeScript)"
	@echo "  make serve      Start test WebDAV server (port $(SERVE_PORT))"
	@echo "  make dev        Watch and rebuild on changes"
	@echo "  make clean      Remove build artifacts"
	@echo "  make distclean  Full clean (includes node_modules)"
	@echo "  make help       Show this help"
