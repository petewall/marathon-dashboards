##@ General

# The help target prints out all targets with their descriptions organized
# beneath their categories. The categories are represented by '##@' and the
# target descriptions by '##'. The awk commands is responsible for reading the
# entire set of makefiles included in this invocation, looking for lines of the
# file as xyz: ## something, and then pretty-format the target and help. Then,
# if there's a line with ##@ something, that gets pretty-printed as a category.
# More info on the usage of ANSI control characters for terminal formatting:
# https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_parameters
# More info on the awk command:
# http://linuxcommand.org/lc3_adv_awk.php

.PHONY: help
help: ## Display this help.
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Dashboards

.PHONY: clean
clean: ## Delete generated dashboards.
	rm -rf dashboards/*

SUMMARY_DASHBOARD := dashboards/summary.json
GAMES := $(wildcard data/*.yaml)
GAME_DASHBOARDS := $(GAMES:data/%.yaml=dashboards/%.json)

dashboards/summary.json: templates/summary-dashboard-template.json ## Builds the summary dashboard.
	@mkdir -p $(dir $@)
	cp $< $@

dashboards/%.json: data/%.yaml templates/game-dashboard-template.json ## Builds the game dashboard.
	@mkdir -p $(dir $@)
	@GAME_TITLE="$$(yq -r '.name' $<)" \
		envsubst '$${GAME_TITLE}' < templates/game-dashboard-template.json > $@

.PHONY: dashboards
dashboards: $(SUMMARY_DASHBOARD) $(GAME_DASHBOARDS) ## Builds all dashboards.

##@ Testing

.PHONY: lint
lint: lint-yaml lint-markdown ## Runs all linters.

YAML_FILES ?= $(shell find . -name "*.yaml" -not -path "./operator/*" -not -path "./charts/alloy-operator/docs/examples/*/output.yaml")
.PHONY: lint-yaml
lint-yaml: $(YAML_FILES) ## Lint yaml files.
	@yamllint $(YAML_FILES)

MARKDOWN_FILES ?= $(shell find . -name "*.md" -not -path "./operator/helm-charts/*")
.PHONY: lint-markdown
lint-markdown: $(MARKDOWN_FILES)  ## Lint markdown files.
ifdef HAS_MARKDOWNLINT
	markdownlint-cli2 $(MARKDOWN_FILES)
else
	docker run --rm --volume $(shell pwd):/workdir davidanson/markdownlint-cli2 $(MARKDOWN_FILES)
endif
