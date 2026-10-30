/** @OnlyCurrentDoc
 * SatinLore's form-bound bridge. No web-app deployment or public Sheet is needed.
 * Put QUESTIONNAIRE_WEBHOOK_SECRET in Project settings > Script properties.
 * After authorisation run installSatinLoreBridge once, then syncExistingSatinLoreResponses.
 */
const SATINLORE_FORM_ID = '1ggoboI_RfFoq9qDUGwgmgbAyCDUZQTgqKjBJpR0nfI8';
const SATINLORE_ENDPOINT = 'https://satinlore.com/api/integrations/questionnaire';
const SATINLORE_SCHEMA = '2026-10-30';
const SATINLORE_ITEMS = ['614059161','724509485','388196135','1636108674','663259038','1632549206','570311130','1592794838','1648945763','1975676399','1017609352','1772532114','1053834982','347755655','1980452728','1394596703','1999140712','1484064820','2026117255','143272130','1705000425','1125137244','145764606','540649580','766322174'];

function installSatinLoreBridge() {
  satinLoreConfig_();
  const form = satinLoreForm_();
  const existing = ScriptApp.getProjectTriggers();
  if (!existing.some(t => t.getHandlerFunction() === 'onSatinLoreFormSubmit')) {
    ScriptApp.newTrigger('onSatinLoreFormSubmit').forForm(form).onFormSubmit().create();
  }
  if (!existing.some(t => t.getHandlerFunction() === 'retrySatinLoreResponses')) {
    ScriptApp.newTrigger('retrySatinLoreResponses').timeBased().everyHours(1).create();
  }
  console.log('SatinLore bridge installed. Run syncExistingSatinLoreResponses once.');
}

function onSatinLoreFormSubmit(event) {
  if (!event || !event.response) throw new Error('Use the installed form-submit trigger.');
  sendSatinLoreResponse_(event.response);
}

function syncExistingSatinLoreResponses() {
  // Only responses captured by this final questionnaire, not earlier incompatible versions.
  // The server rejects incomplete/unknown schemas and never treats an answer as email verification.
  syncSatinLoreSince_(new Date('2026-10-30T00:00:00Z'));
}

function retrySatinLoreResponses() {
  const properties = PropertiesService.getScriptProperties();
  const cursor = Number(properties.getProperty('SATINLORE_SYNC_CURSOR') || Date.now());
  syncSatinLoreSince_(new Date(Math.max(Date.parse('2026-10-30T00:00:00Z'), cursor - 24 * 3600000)));
}

function syncSatinLoreSince_(since) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const started = Date.now();
    const responses = satinLoreForm_().getResponses(since).sort((a,b) => a.getTimestamp() - b.getTimestamp());
    for (const response of responses) {
      if (Date.now() - started > 240000) throw new Error('Sync paused; run again to continue.');
      sendSatinLoreResponse_(response);
      PropertiesService.getScriptProperties().setProperty('SATINLORE_SYNC_CURSOR', String(response.getTimestamp().getTime()));
    }
    PropertiesService.getScriptProperties().setProperty('SATINLORE_LAST_SUCCESS', new Date().toISOString());
    console.log('Sync complete. Checked ' + responses.length + ' responses.');
  } finally { lock.releaseLock(); }
}

function satinLoreForm_() {
  const form = FormApp.getActiveForm();
  if (!form || form.getId() !== SATINLORE_FORM_ID) throw new Error('This script must be bound to the SatinLore questionnaire.');
  return form;
}

function satinLoreConfig_() {
  const secret = PropertiesService.getScriptProperties().getProperty('QUESTIONNAIRE_WEBHOOK_SECRET') || '';
  if (secret.length < 32) throw new Error('Add the private webhook secret in Script properties first.');
  return secret;
}

function sendSatinLoreResponse_(response) {
  const secret = satinLoreConfig_();
  const answers = {};
  response.getItemResponses().forEach(item => {
    const id = String(item.getItem().getId());
    if (SATINLORE_ITEMS.indexOf(id) !== -1) answers[id] = item.getResponse();
  });
  // Do not transmit stories/toys without explicit consent, even if an edited response kept old answers.
  if (answers['1017609352'] !== 'Yes, I agree') {
    ['1772532114','1053834982','347755655','1980452728','1394596703','1999140712'].forEach(id => delete answers[id]);
  }
  if (answers['614059161'] !== 'Yes') return; // No personal data from under-18 exits.
  const body = JSON.stringify({schemaVersion:SATINLORE_SCHEMA,formId:SATINLORE_FORM_ID,responseId:response.getId(),submittedAt:response.getTimestamp().toISOString(),answers:answers});
  const timestamp = String(Date.now());
  const signature = Utilities.computeHmacSha256Signature(timestamp + '.' + body, secret, Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
  const result = UrlFetchApp.fetch(SATINLORE_ENDPOINT, {
    method:'post',contentType:'application/json',payload:body,
    headers:{'X-SatinLore-Timestamp':timestamp,'X-SatinLore-Signature':signature},
    muteHttpExceptions:true,followRedirects:false
  });
  const status = result.getResponseCode();
  if ([400,409,422].indexOf(status) !== -1) {
    // Keep a minimal review marker, not the submitted answers. A bad response must not block later people.
    const idHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,response.getId(),Utilities.Charset.UTF_8)
      .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
    PropertiesService.getScriptProperties().setProperty('SATINLORE_REVIEW_' + idHash, String(status));
    console.warn('One response needs founder review (HTTP ' + status + '). Other responses can continue.');
    return;
  }
  if (status < 200 || status >= 300) {
    // No addresses, answers, credentials, bodies or response IDs in execution logs.
    throw new Error('SatinLore sync failed (HTTP ' + status + '). Check configuration and retry.');
  }
}
