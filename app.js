```javascript
/**
 * YONS AGEN CUSTOMER
 * Isi API_URL dengan URL Web App Google Apps Script hasil deployment.
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbzVm9b0veD1_uhaa9-bBjtgzMoKW6Jd1_lpQVQp6a9MKEKMbqrzFWDigiUgtGcZIj8AzA/exec';

const state = {
    products: [],
    cart: [],
    lat: '',
    lng: '',
    view: 'products'
};

const $ = id => document.getElementById(id);

/**
 * Format angka menjadi mata uang Rupiah.
 */
const rupiah = n =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(Number(n) || 0);

/**
 * Mengamankan teks sebelum dimasukkan ke HTML.
 */
const esc = s =>
    String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));

/**
 * Mengirim permintaan ke Google Apps Script menggunakan JSONP.
 */
function apiGet(action, payload = {}) {
    return new Promise((resolve, reject) => {
        if (!API_URL || API_URL.startsWith('GANTI_')) {
            return reject(
                new Error('URL Apps Script belum diisi di app.js.')
            );
        }

        const cb =
            'yonsCb_' +
            Date.now() +
            '_' +
            Math.floor(Math.random() * 10000);

        const script = document.createElement('script');

        const timeout = setTimeout(() => {
            finish(
                new Error('Permintaan ke server melewati batas waktu.')
            );
        }, 25000);

        function finish(err, data) {
            clearTimeout(timeout);
            delete window[cb];
            script.remove();

            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        }

        window[cb] = data => finish(null, data);

        script.onerror = () => {
            finish(
                new Error(
                    'Tidak dapat terhubung ke server. ' +
                    'Periksa URL dan deployment Apps Script.'
                )
            );
        };

        const params = new URLSearchParams({
            action,
            callback: cb
        });

        if (payload && Object.keys(payload).length) {
            params.set('payload', JSON.stringify(payload));
        }

        script.src = API_URL + '?' + params.toString();
        document.body.appendChild(script);
    });
}

/**
 * Menampilkan notifikasi kepada pengguna.
 */
function setNotice(text, warning = false) {
    $('notice').textContent = text;
    $('notice').classList.toggle('warning', warning);
}

/**
 * Memuat produk dari server.
 */
async function loadProducts() {
    setNotice('Memuat produk dari YONS AGEN…');
    $('reload').disabled = true;

    try {
        const r = await apiGet('products');

        if (!r.ok) {
            throw new Error(r.error || 'Produk gagal dimuat.');
        }

        state.products = r.products || [];

        renderCategories();
        renderProducts();

        setNotice(
            state.products.length
                ? 'Pilih produk yang ingin dipesan.'
                : 'Belum ada produk aktif dengan stok tersedia.'
        );
    } catch (e) {
        setNotice(e.message, true);
    } finally {
        $('reload').disabled = false;
    }
}

/**
 * Menampilkan daftar kategori produk.
 */
function renderCategories() {
    const old = $('category').value;

    const cats = [
        ...new Set(
            state.products
                .map(p => p.kategori)
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b, 'id'));

    $('category').innerHTML =
        '<option value="">Semua kategori</option>' +
        cats.map(c =>
            `<option value="${esc(c)}">${esc(c)}</option>`
        ).join('');

    if (cats.includes(old)) {
        $('category').value = old;
    }
}

/**
 * Menampilkan dan memfilter produk.
 */
function renderProducts() {
    const q = $('search')
        .value
        .trim()
        .toLocaleLowerCase('id');

    const cat = $('category').value;

    const list = state.products.filter(p =>
        (!cat || p.kategori === cat) &&
        (
            !q ||
            `${p.nama} ${p.deskripsi} ${p.kategori}`
                .toLocaleLowerCase('id')
                .includes(q)
        )
    );

    const grid = $('products');

    if (!list.length) {
        grid.innerHTML =
            '<p class="muted">Produk tidak ditemukan.</p>';
        return;
    }

    grid.innerHTML = list.map(p => `
        <article class="product">
            <button
                type="button"
                class="product-photo photo-button"
                data-detail="${esc(p.id)}"
                aria-label="Lihat detail ${esc(p.nama)}"
            >
                ${
                    p.foto
                        ? `
                            <img
                                loading="lazy"
                                src="${esc(p.foto)}"
                                alt="${esc(p.nama)}"
                                onerror="this.remove();this.parentElement.innerHTML='<span class=&quot;photo-fallback&quot;>▧</span>'"
                            >
                        `
                        : '<span class="photo-fallback">▧</span>'
                }
            </button>

            <div class="product-body">
                <span class="category">
                    ${esc(p.kategori || 'Produk YONS AGEN')}
                </span>

                <h3>
                    <button
                        type="button"
                        class="product-name-link"
                        data-detail="${esc(p.id)}"
                    >
                        ${esc(p.nama)}
                    </button>
                </h3>

                <p class="description">
                    ${esc(p.deskripsi || '')}
                </p>

                <div class="price">
                    ${rupiah(p.harga)}
                    <span class="muted small">
                        / ${esc(p.satuan || 'unit')}
                    </span>
                </div>

                <div class="stock">
                    Stok tersedia:
                    ${Number(p.stok) || 0}
                    ${esc(p.satuan || 'unit')}
                </div>

                <div class="add-row">
                    <input
                        class="qty"
                        type="number"
                        min="1"
                        max="${Number(p.stok) || 1}"
                        value="1"
                        id="qty-${esc(p.id)}"
                        aria-label="Jumlah ${esc(p.nama)}"
                    >

                    <button
                        type="button"
                        class="button primary"
                        data-add="${esc(p.id)}"
                    >
                        + Keranjang
                    </button>
                </div>
            </div>
        </article>
    `).join('');
}

/**
 * Menampilkan detail produk.
 */
function showProductDetail(id) {
    const p = state.products.find(
        x => String(x.id) === String(id)
    );

    if (!p) return;

    const detail = $('productDetail');

    detail.innerHTML = `
        <div class="detail-head">
            <span class="eyebrow">DETAIL PRODUK</span>

            <button
                type="button"
                id="closeProductDetail"
                class="button secondary"
            >
                Tutup detail ✕
            </button>
        </div>

        <div class="detail-content">
            <div class="detail-photo">
                ${
                    p.foto
                        ? `
                            <img
                                src="${esc(p.foto)}"
                                alt="${esc(p.nama)}"
                                onerror="this.style.display='none'"
                            >
                        `
                        : '<span class="photo-fallback">▧</span>'
                }
            </div>

            <div class="detail-info">
                <span class="category">
                    ${esc(p.kategori || 'Produk YONS AGEN')}
                </span>

                <h2>${esc(p.nama)}</h2>

                <div class="price">
                    ${rupiah(p.harga)}
                    <span class="muted small">
                        / ${esc(p.satuan || 'unit')}
                    </span>
                </div>

                <p class="detail-description">
                    ${esc(p.deskripsi || 'Belum ada deskripsi produk.')}
                </p>

                <p class="stock">
                    Stok tersedia:
                    <strong>
                        ${Number(p.stok) || 0}
                        ${esc(p.satuan || 'unit')}
                    </strong>
                </p>

                <div class="add-row">
                    <input
                        class="qty"
                        type="number"
                        min="1"
                        max="${Number(p.stok) || 1}"
                        value="1"
                        id="detailQty"
                        aria-label="Jumlah ${esc(p.nama)}"
                    >

                    <button
                        type="button"
                        class="button primary"
                        data-detail-add="${esc(p.id)}"
                    >
                        + Tambahkan ke Keranjang
                    </button>
                </div>
            </div>
        </div>
    `;

    detail.classList.remove('hidden');

    detail.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

/**
 * Berpindah antara halaman produk dan keranjang.
 */
function setView(view) {
    state.view = view;

    $('productsPage').classList.toggle(
        'hidden',
        view !== 'products'
    );

    $('cartSection').classList.toggle(
        'hidden',
        view !== 'cart'
    );

    $('heroSection').classList.toggle(
        'hidden',
        view !== 'products'
    );

    if (view === 'cart') {
        $('cartSection').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    } else {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
}

/**
 * Menambahkan produk ke keranjang.
 */
function addToCart(id) {
    const p = state.products.find(
        x => String(x.id) === String(id)
    );

    if (!p) return;

    const input = $('qty-' + id);
    const qty = Math.floor(Number(input?.value) || 0);

    const existing = state.cart.find(
        x => String(x.id) === String(id)
    );

    const next = qty + (existing?.qty || 0);

    if (qty < 1) {
        return alert('Jumlah barang minimal 1.');
    }

    if (next > Number(p.stok)) {
        return alert(
            'Jumlah melebihi stok tersedia (' + p.stok + ').'
        );
    }

    if (existing) {
        existing.qty = next;
    } else {
        state.cart.push({
            id: p.id,
            nama: p.nama,
            satuan: p.satuan,
            harga: Number(p.harga) || 0,
            qty,
            stok: Number(p.stok) || 0
        });
    }

    renderCart();
    setNotice(p.nama + ' ditambahkan ke keranjang.');
}

/**
 * Menampilkan isi keranjang dan subtotal.
 */
function renderCart() {
    const n = state.cart.reduce(
        (s, x) => s + x.qty,
        0
    );

    const total = state.cart.reduce(
        (s, x) => s + x.qty * x.harga,
        0
    );

    $('cartCount').textContent = n;
    $('cartSummary').textContent = n + ' barang';
    $('subtotal').textContent = rupiah(total);

    const box = $('cartItems');

    if (!state.cart.length) {
        box.innerHTML =
            '<p class="muted">Belum ada barang di keranjang.</p>';
        return;
    }

    box.innerHTML = state.cart.map(x => `
        <div class="cart-line">
            <div>
                <strong>
                    <button
                        type="button"
                        class="cart-product-link"
                        data-product="${esc(x.id)}"
                    >
                        ${esc(x.nama)}
                    </button>
                </strong>

                <small>
                    ${rupiah(x.harga)} / ${esc(x.satuan)}
                </small>
            </div>

            <div class="cart-price">
                <strong>${rupiah(x.qty * x.harga)}</strong>
            </div>

            <div class="cart-controls">
                <button
                    type="button"
                    class="mini"
                    data-dec="${esc(x.id)}"
                    aria-label="Kurangi"
                >
                    −
                </button>

                <strong>${x.qty}</strong>

                <button
                    type="button"
                    class="mini"
                    data-inc="${esc(x.id)}"
                    aria-label="Tambah"
                >
                    +
                </button>
            </div>

            <button
                type="button"
                class="remove"
                data-remove="${esc(x.id)}"
            >
                Hapus
            </button>
        </div>
    `).join('');
}

/**
 * Mengubah jumlah barang di keranjang.
 */
function changeQty(id, delta) {
    const item = state.cart.find(
        x => String(x.id) === String(id)
    );

    if (!item) return;

    const next = item.qty + delta;

    if (next < 1) {
        state.cart = state.cart.filter(
            x => String(x.id) !== String(id)
        );
    } else if (next > item.stok) {
        alert(
            'Jumlah melebihi stok tersedia (' + item.stok + ').'
        );
        return;
    } else {
        item.qty = next;
    }

    renderCart();
}

/**
 * Event klik pada daftar produk.
 */
$('products').addEventListener('click', e => {
    const detail = e.target.closest('[data-detail]');

    if (detail) {
        showProductDetail(detail.dataset.detail);
        return;
    }

    const b = e.target.closest('[data-add]');

    if (b) {
        addToCart(b.dataset.add);
    }
});

/**
 * Event pada panel detail produk.
 */
$('productDetail').addEventListener('click', e => {
    if (e.target.closest('#closeProductDetail')) {
        $('productDetail').classList.add('hidden');
        return;
    }

    const b = e.target.closest('[data-detail-add]');

    if (!b) return;

    const p = state.products.find(
        x => String(x.id) === String(b.dataset.detailAdd)
    );

    if (!p) return;

    const input = $('detailQty');
    const qty = Math.floor(Number(input?.value) || 0);

    const existing = state.cart.find(
        x => String(x.id) === String(p.id)
    );

    const next = qty + (existing?.qty || 0);

    if (qty < 1) {
        return alert('Jumlah barang minimal 1.');
    }

    if (next > Number(p.stok)) {
        return alert(
            'Jumlah melebihi stok tersedia (' + p.stok + ').'
        );
    }

    if (existing) {
        existing.qty = next;
    } else {
        state.cart.push({
            id: p.id,
            nama: p.nama,
            satuan: p.satuan,
            harga: Number(p.harga) || 0,
            qty,
            stok: Number(p.stok) || 0
        });
    }

    renderCart();
    setNotice(p.nama + ' ditambahkan ke keranjang.');

    alert(p.nama + ' ditambahkan ke keranjang.');
});

/**
 * Event pada daftar keranjang.
 */
$('cartItems').addEventListener('click', e => {
    const product = e.target.closest('[data-product]');

    if (product) {
        setView('products');
        showProductDetail(product.dataset.product);
        return;
    }

    const b = e.target.closest('button');

    if (!b) return;

    if (b.dataset.inc) {
        changeQty(b.dataset.inc, 1);
    }

    if (b.dataset.dec) {
        changeQty(b.dataset.dec, -1);
    }

    if (b.dataset.remove) {
        state.cart = state.cart.filter(
            x => String(x.id) !== String(b.dataset.remove)
        );

        renderCart();
    }
});

/**
 * Event pencarian dan filter kategori.
 */
$('search').addEventListener('input', renderProducts);
$('category').addEventListener('change', renderProducts);
$('reload').addEventListener('click', loadProducts);

/**
 * Navigasi keranjang.
 */
$('cartJump').addEventListener('click', () => {
    renderCart();
    setView('cart');
});

$('backToProducts').addEventListener('click', () => {
    setView('products');
});

/**
 * Mengambil koordinat lokasi perangkat.
 */
$('gpsButton').addEventListener('click', () => {
    if (!navigator.geolocation) {
        $('gpsStatus').textContent =
            'GPS tidak didukung browser ini.';
        return;
    }

    $('gpsStatus').textContent = 'Meminta izin lokasi…';

    navigator.geolocation.getCurrentPosition(
        pos => {
            state.lat = pos.coords.latitude;
            state.lng = pos.coords.longitude;

            $('gpsStatus').textContent =
                'Lokasi berhasil diambil. Tetap isi alamat lengkap.';
        },
        err => {
            $('gpsStatus').textContent =
                err.code === 1
                    ? 'Izin lokasi ditolak. Anda tetap bisa mengisi alamat manual.'
                    : 'Lokasi tidak tersedia. Silakan isi alamat manual.';
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
        }
    );
});

/**
 * Memproses pengiriman pesanan.
 */
$('orderForm').addEventListener('submit', async e => {
    e.preventDefault();

    if (!state.cart.length) {
        return alert('Keranjang masih kosong.');
    }

    const form = new FormData(e.currentTarget);

    const payload = {
        nama: String(form.get('nama') || '').trim(),
        hp: String(form.get('hp') || '').trim(),
        alamat: String(form.get('alamat') || '').trim(),
        pembayaran: String(form.get('pembayaran') || ''),
        catatan: String(form.get('catatan') || '').trim(),
        lat: state.lat,
        lng: state.lng,
        items: state.cart.map(x => ({
            id: x.id,
            qty: x.qty
        }))
    };

    const subtotal = state.cart.reduce(
        (s, x) => s + x.qty * x.harga,
        0
    );

    if (
        !confirm(
            'Kirim pesanan dengan subtotal ' +
            rupiah(subtotal) +
            '? Ongkir akan ditentukan admin setelah pesanan diterima.'
        )
    ) {
        return;
    }

    const btn = $('submitOrder');

    btn.disabled = true;
    btn.textContent = 'Mengirim pesanan…';

    try {
        const r = await apiGet('submitOrder', payload);

        if (!r.ok) {
            throw new Error(r.error || 'Pesanan gagal dikirim.');
        }

        $('successText').innerHTML =
            'Nomor pesanan: <strong>' +
            esc(r.orderId) +
            '</strong><br>' +
            'Subtotal barang: <strong>' +
            rupiah(r.subtotal) +
            '</strong><br><br>' +
            'Admin akan memeriksa stok dan mengonfirmasi ongkir serta total tagihan.';

        $('successModal').classList.remove('hidden');

        state.cart = [];
        renderCart();

        e.currentTarget.reset();

        state.lat = '';
        state.lng = '';

        $('gpsStatus').textContent =
            'Opsional, perlu izin lokasi dari perangkat.';

        await loadProducts();
    } catch (err) {
        alert('Pesanan belum berhasil dikirim: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Kirim Pesanan';
    }
});

/**
 * Menutup modal pesanan berhasil.
 */
$('closeModal').addEventListener('click', () => {
    $('successModal').classList.add('hidden');
});

/**
 * Inisialisasi aplikasi.
 */
loadProducts();
renderCart();
```
