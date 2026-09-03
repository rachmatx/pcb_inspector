# DESIGN — PCB Inspector

## 1. Design objective

The interface should make the computer-vision result immediately understandable.

The user should be able to answer three questions within seconds:

1. What did the model detect?
2. Where is it?
3. How confident is the model?

## 2. Design principles

### Visual-first
The annotated PCB image is the primary result.

### Minimal
Avoid dashboards full of unrelated statistics.

### Trust through transparency
Show model version, confidence, and processing time.

### Responsive
The same product should work on desktop and mobile browsers.

### Accessible
Do not communicate defect classes using color alone. Use labels and icons/text.

## 3. Main screens

### Home
Elements:
- product name
- short explanation
- Upload Image button
- Camera button
- supported image information

### Inspection
Elements:
- image preview
- upload/capture action
- processing state

### Result
Elements:
- annotated image
- total defects
- defect list
- confidence
- processing time
- model version
- start new inspection

## 4. User flow

```text
Home
  |
  +--> Upload
  |       |
  |       v
  |    Preview
  |       |
  +--> Camera
          |
          v
        Preview
          |
          v
       Analyze
          |
          v
       Loading
          |
          v
        Result
```

## 5. Result layout

Desktop:
- left: annotated image
- right: detection summary

Mobile:
- annotated image first
- summary below it

## 6. Bounding box visualization

Each detection should show:
- class name
- confidence
- bounding rectangle

The UI must not imply that confidence equals probability of a PCB being defective.

## 7. Empty state

If no defect is detected:

> No supported defect detected.

Do not display:

> PCB is perfect.

The model only detects the classes it was trained to recognize.

## 8. Error state

Examples:
- Image is too large.
- Unsupported image format.
- Analysis service unavailable.
- Model inference failed.

The error should explain the next action.

## 9. Visual style

Suggested direction:
- dark neutral or light neutral interface
- technical but approachable
- strong typography
- restrained accent color
- no unnecessary decorative PCB illustrations

## 10. Accessibility

- readable text contrast
- keyboard-accessible web controls
- descriptive button labels
- bounding-box labels in addition to color
- do not rely on red/green alone
