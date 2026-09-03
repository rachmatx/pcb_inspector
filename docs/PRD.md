# PRD — PCB Inspector

## 1. Product summary

PCB Inspector is an AI-assisted inspection application that detects and localizes visible PCB defects from an image.

A user can upload an image or capture one with a camera. The system sends the image to an ML inference service. The service returns detected defect classes, bounding boxes, and confidence scores.

## 2. Problem

Manual PCB inspection can be repetitive and difficult when defects are small. The project explores whether a lightweight object-detection model can automatically identify and localize common PCB defects.

This project is an academic prototype, not an industrial safety or manufacturing certification system.

## 3. Target users

### Primary
- students learning computer vision
- researchers experimenting with PCB defect detection
- lecturers/demo audiences
- users who want to inspect sample PCB images

### Secondary
- small electronics hobbyists
- educational labs

## 4. Goals

1. Train a custom PCB defect detector.
2. Detect multiple defect categories in one image.
3. Localize defects with bounding boxes.
4. Evaluate the model using reproducible metrics.
5. Expose the trained model through an API.
6. Provide a simple web interface.
7. Provide a thin mobile client using the same API.
8. Produce research-ready experiment records.

## 5. MVP features

### Image input
- upload image
- camera capture
- image preview
- validation for file type and size

### Detection
- run inference
- draw bounding boxes
- show class name
- show confidence
- count detections

### Result
- annotated image
- detection table
- processing time
- model version

### Research transparency
The application must expose enough metadata for a result to be traceable to a model version.

## 6. Non-goals

The MVP will not:
- declare a PCB safe or unsafe
- guarantee manufacturing quality
- diagnose electrical functionality
- repair PCB defects
- use an LLM for visual detection
- train models inside the web/mobile application

## 7. Functional requirements

### FR-01 Upload
The user can select a supported image.

### FR-02 Camera
The mobile application can capture an image.

### FR-03 Prediction
The backend accepts an image and returns detections.

### FR-04 Visualization
The frontend displays bounding boxes aligned with the original image.

### FR-05 Detection metadata
Each detection contains:
- class
- confidence
- bounding box

### FR-06 Summary
The system shows total detections and counts by class.

### FR-07 Error handling
The system handles:
- invalid files
- oversized files
- failed inference
- unavailable backend
- malformed model output

## 8. Non-functional requirements

- responsive web UI
- simple interaction flow
- predictable API response schema
- reproducible model versioning
- no secrets committed to Git
- inference endpoint must not expose internal file paths
- reasonable inference latency for a student cloud deployment

## 9. Acceptance criteria

The MVP is accepted when:

- a valid PCB image can be uploaded
- the backend returns a successful prediction
- bounding boxes are rendered correctly
- detected classes are shown
- confidence scores are shown
- the same API can be called by web and mobile
- model version is recorded
- failed requests return useful errors
- the final model has documented evaluation results

## 10. Future features

Only after the MVP is stable:
- prediction history
- downloadable inspection report
- batch image inspection
- user accounts
- model comparison page
- confidence threshold controls
- model performance dashboard

These are explicitly outside the first implementation cycle.
