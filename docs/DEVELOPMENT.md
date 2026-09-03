# DEVELOPMENT — PCB Inspector

## 1. Goal

Build the project incrementally while minimizing unnecessary AI-agent context and token consumption.

## 2. Development order

1. documentation
2. dataset audit
3. ML environment
4. baseline training
5. evaluation
6. experiments
7. inference API
8. web
9. mobile
10. integration
11. deployment
12. testing

## 3. AI agent rules

### Always
- inspect only relevant files
- read `DECISIONS.md` before architectural changes
- read the relevant section of `ARCHITECTURE.md`
- make small changes
- test after changes
- report exactly what changed

### Never
- scan the whole repository unnecessarily
- regenerate existing documentation without a reason
- rewrite working code
- change the stack without a decision record
- add dependencies without justification
- include raw datasets in context
- include model weights in context
- read generated build directories
- read node_modules
- read Python virtual environments
- use the LLM for model inference

## 4. Task format

Every coding task should have:

```text
Goal:
Relevant files:
Constraints:
Expected result:
Tests:
```

## 5. Commit strategy

Suggested:
- `docs: initialize project documentation`
- `ml: add dataset audit`
- `ml: add baseline training`
- `ml: add evaluation pipeline`
- `api: add prediction endpoint`
- `web: add image upload`
- `web: add detection visualization`
- `mobile: add camera capture`
- `test: add prediction API tests`

## 6. Branching

For a solo project, a simple main branch plus short-lived feature branches is sufficient.

Do not create complicated Git workflows unless required.

## 7. Local machine role

The user's PC is primarily for:
- coding
- dataset inspection
- preprocessing
- lightweight inference
- web development
- mobile development

Cloud GPU is preferred for:
- model training
- repeated experiments
- larger-resolution experiments

## 8. Environment separation

Use separate environments for:
- ML
- backend
- web
- mobile

The exact setup can be simplified later if dependencies overlap.

## 9. Definition of ready

A task is ready when:
- objective is clear
- relevant files are known
- expected output is known
- test method is known

## 10. Definition of done

A task is done when:
- implementation exists
- tests/checks pass
- documentation is updated if behavior changed
- experiment records are saved if ML-related
