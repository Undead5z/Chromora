const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const human = value => String(value || 'Not recorded').replaceAll('_', ' ');
const line = (doc, label, value) => doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(value == null || value === '' ? 'Not recorded' : String(value));

const generateFieldTestReport = ({ record, potentialIssues, outputPath }) => new Promise((resolve, reject) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);
  doc.fillColor('#142238').fontSize(22).font('Helvetica-Bold').text('CHROMORA');
  doc.fillColor('#6D5DFB').fontSize(8).text('SEE. VERIFY. SECURE.');
  doc.fillColor('#142238').moveDown().fontSize(16).text('FIELD TEST RECORD');
  doc.fontSize(9).font('Helvetica').fillColor('#334155').text('Presumptive field-test documentation');
  const section = title => { doc.moveDown().fillColor('#6D5DFB').font('Helvetica-Bold').fontSize(10).text(title); doc.moveTo(48, doc.y + 3).lineTo(547, doc.y + 3).strokeColor('#CBD5E1').stroke(); doc.moveDown(.5).fillColor('#142238').fontSize(9); };
  section('TEST INFORMATION');
  line(doc, 'Test ID', record.test_number); line(doc, 'Test Profile', record.test_profile); line(doc, 'Captured At', record.captured_at); line(doc, 'Presumptive Result', human(record.presumptive_result)); line(doc, 'Capture Quality', human(record.capture_quality)); line(doc, 'Reference Card Status', human(record.reference_card_status)); line(doc, 'Analysis Source', human(record.analysis_source)); line(doc, 'Last Analysis At', record.last_analysis_at);
  section('OPERATOR'); line(doc, 'Operator Name', record.operator_name); line(doc, 'Employee ID', record.operator_employee_id); line(doc, 'Department', record.department);
  section('LOCATION'); line(doc, 'Location Label', record.location_label); line(doc, 'Latitude', record.latitude); line(doc, 'Longitude', record.longitude); line(doc, 'GPS Accuracy', record.location_accuracy == null ? null : `±${Math.round(record.location_accuracy)} m`);
  section('EVIDENCE & INTEGRITY'); line(doc, 'Image SHA-256', record.image_sha256); line(doc, 'Signature Algorithm', record.signature_algorithm); line(doc, 'Integrity Status', human(record.integrity_status));
  section('LAB REVIEW'); line(doc, 'Status', human(record.lab_review_status)); line(doc, 'Requested At', record.lab_review_requested_at); line(doc, 'Requested By', record.lab_review_requested_by); line(doc, 'Review Note', record.lab_review_note);
  section('POTENTIAL ISSUES'); if (potentialIssues.length) potentialIssues.forEach(issue => doc.font('Helvetica-Bold').text(`${issue.severity}: ${issue.title}`, { continued: true }).font('Helvetica').text(` — ${issue.description}`)); else doc.font('Helvetica').text('No record-level operational/evidence issues detected.');
  section('ANALYSIS CAPABILITY'); [['Image Quality', record.capture_quality === 'ACCEPTABLE' ? 'Complete' : human(record.capture_quality)], ['Reference Card', 'Not Implemented'], ['Colour Calibration', 'Not Implemented'], ['Reaction Region', 'Not Implemented'], ['Classification', 'Not Implemented']].forEach(([label, value]) => line(doc, label, value));
  if (record.original_image_path && fs.existsSync(record.original_image_path)) { section('ORIGINAL EVIDENCE'); try { doc.image(record.original_image_path, { fit: [480, 260], align: 'center' }); } catch { doc.text('No evidence image attached to this record.'); } } else { section('ORIGINAL EVIDENCE'); doc.text('No evidence image attached to this record.'); }
  doc.moveDown().fillColor('#475569').fontSize(8).text('Presumptive field-test result. Laboratory confirmation remains the confirmatory process.');
  if (record.data_origin === 'DEMO_SEED') doc.text('Prototype demonstration record — not operational NCB data.');
  doc.end(); stream.on('finish', resolve); stream.on('error', reject);
});
module.exports = { generateFieldTestReport };
