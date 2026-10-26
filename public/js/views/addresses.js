import { $, $$, esc } from '../util.js';
import { ic } from '../art.js';
import { api } from '../api.js';
import { state } from '../state.js';
import { openModal, closeModal, toast } from '../ui.js';
import { updateHeader } from './header.js';
import { render } from '../router.js';

export const addrIcon = a => ic(a.label === 'Work' ? 'work' : a.label === 'Home' ? 'home' : 'pin');
export const addrLine = a => `${esc(a.street)}${a.details ? ', ' + esc(a.details) : ''}, ${esc(a.city)}`;

export function openAddressForm({ then } = {}) {
  let label = 'Home';
  const m = openModal(`
    <div class="modal-head"><h2 id="addr-title">Add an address</h2><p>Where should the courier bring your food?</p></div>
    <form id="addr-form" novalidate>
      <div class="modal-body">
        <p class="form-error" id="addr-error" role="alert"></p>
        <div class="field"><span class="label">Label</span>
          <div class="seg" role="group" aria-label="Address label">${['Home', 'Work', 'Other'].map(l => `<button type="button" data-label="${l}" aria-pressed="${l === label}">${l}</button>`).join('')}</div></div>
        <div class="field"><label for="f-street">Street and number</label><input class="input" id="f-street" autocomplete="address-line1" autofocus placeholder="14 Linden Street" maxlength="120"><p class="err" id="e-street"></p></div>
        <div class="field"><label for="f-details">Flat, floor or entrance <small>Optional</small></label><input class="input" id="f-details" autocomplete="address-line2" placeholder="Flat 3, second floor" maxlength="120"></div>
        <div class="field"><label for="f-city">City or district</label><input class="input" id="f-city" autocomplete="address-level2" placeholder="Old Town" maxlength="80"><p class="err" id="e-city"></p></div>
        <label class="choice"><input type="checkbox" id="f-default" ${state.user && state.user.addresses.length ? '' : 'checked disabled'}><span>Make this my default address</span></label>
      </div>
      <div class="modal-foot"><button class="btn btn-primary btn-block" type="submit" id="addr-save">Save address</button></div>
    </form>`, { label: 'addr-title' });
  const w = m.wrap;
  w.addEventListener('click', e => {
    const b = e.target.closest('[data-label]');
    if (!b) return;
    label = b.dataset.label;
    $$('[data-label]', w).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  w.addEventListener('submit', async e => {
    e.preventDefault();
    const street = $('#f-street', w), city = $('#f-city', w);
    const errs = { street: street.value.trim().length < 3 ? 'Enter a street and number.' : '', city: city.value.trim().length < 2 ? 'Enter a city or district.' : '' };
    [['street', street], ['city', city]].forEach(([k, el]) => { el.closest('.field').classList.toggle('invalid', !!errs[k]); $('#e-' + k, w).textContent = errs[k]; });
    if (errs.street) { street.focus(); return; }
    if (errs.city) { city.focus(); return; }
    const btn = $('#addr-save', w);
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Saving…';
    $('#addr-error', w).textContent = '';
    try {
      const { user, addressId } = await api.addAddress({ label, street: street.value, details: $('#f-details', w).value, city: city.value, makeDefault: $('#f-default', w).checked });
      state.user = user;
      const added = user.addresses.find(a => a._id === addressId);
      state.co.addressId = addressId;
      closeModal(m);
      updateHeader();
      toast('Address saved');
      if (then) then(added); else render(true);
    } catch (err) { btn.disabled = false; btn.textContent = 'Save address'; $('#addr-error', w).textContent = err.message; }
  });
}

export function openAddressPicker() {
  const u = state.user;
  const m = openModal(`
    <div class="modal-head"><h2 id="pick-title">Deliver to</h2><p>Choose your default delivery address.</p></div>
    <div class="modal-body">
      ${u.addresses.map(a => `
        <label class="radio-card"><input type="radio" name="pick" value="${a._id}" ${a.isDefault ? 'checked' : ''}>
          <span class="rc-ic">${addrIcon(a)}</span>
          <span class="rc-main"><strong>${esc(a.label)}</strong><span class="sub">${addrLine(a)}</span></span></label>`).join('')}
      <button class="btn btn-outline btn-block" type="button" data-new style="margin-top:6px">${ic('plus')} Add a new address</button>
    </div>`, { label: 'pick-title' });
  m.wrap.addEventListener('change', async e => {
    if (e.target.name !== 'pick') return;
    try {
      state.user = await api.setDefaultAddress(e.target.value);
      state.co.addressId = e.target.value;
      updateHeader();
      closeModal(m);
      render(true);
      toast('Delivery address updated');
    } catch (err) { toast(err.message); }
  });
  m.wrap.addEventListener('click', e => { if (e.target.closest('[data-new]')) { closeModal(m); openAddressForm(); } });
}
