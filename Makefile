# Prerequisites:
#   Node.js (v18 or later) and npm must be installed.
#   $ node --version && npm --version
#

NPX := npx
NPM := npm

# Port for the test WebDAV server
SERVE_PORT := 18080

default: build
.PHONY: default

# ============================================================
# Targets
# ============================================================

## Install dependencies
## Run this for initial setup.
install: node_modules

node_modules: package.json package-lock.json
	$(NPM) ci
	@touch $@

build: node_modules
	$(NPM) run build

test: node_modules
	$(NPM) test

lint: node_modules
	$(NPX) tsc --noEmit

## Start test WebDAV server
## Deploys dist/davpage.html to the WebDAV root if it exists.
serve: node_modules
	$(NPM) run serve -- $(SERVE_PORT)

## Watch source files and rebuild on changes
dev: node_modules
	$(NPM) run dev

clean:
	rm -rf dist tmp

distclean: clean
	rm -rf node_modules

help:
	@echo "Available targets:"
	@echo ""
	@echo "  make install    Install dependencies (first time only)"
	@echo "  make build      Build (generates dist/davpage.html)  [default]"
	@echo "  make test       Run tests"
	@echo "  make lint       Static type checking (TypeScript)"
	@echo "  make serve      Start test WebDAV server (port $(SERVE_PORT))"
	@echo "  make dev        Watch and rebuild on changes"
	@echo "  make clean      Remove build artifacts"
	@echo "  make distclean  Full clean (includes node_modules)"
	@echo "  make help       Show this help"

.PHONY: install build test lint serve dev clean distclean help
