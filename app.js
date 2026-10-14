```javascript
/* =========================================================
 * YONS AGEN CUSTOMER
 * Aplikasi pemesanan pelanggan.
 * Isi API_URL dengan URL Web App Google Apps Script.
 * ========================================================= */

const API_URL = 'https://script.google.com/macros/s/AKfycbzVm9b0veD1_uhaa9-bBjtgzMoKW6Jd1_lpQVQp6a9MKEKMbqrzFWDigiUgtGcZIj8AzA/exec';

const state = {
    products: [],
    cart: [],
    lat: '',
    lng: ''
};

// =========================================================
// UTILITAS
// =========================================================

const $ = id => document.getElementById(id);

const rupiah = n =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(Number(n) || 0);

const esc = value =>
    String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);

function setNotice(text, warning = false) {
    $('notice').textContent = text;
    $('notice').classList.toggle('warning', warning);
}

// =========================================================
// API GOOGLE APPS SCRIPT
// =========================================================

function apiGet(action, payload = {}) {
    return new Promise((resolve, reject) => {
        if (!API_URL || API_URL.startsWith('GANTI_')) {
            reject(
                new Error(
                    'URL Apps Script belum diisi di app.js.'
                )
            );
            return;
        }

        const callbackName =
            'yonsCb_' +
            Date.now() +
            '_' +
            Math.floor(Math.random() * 10000);

        const script = document.createElement('script');

        let finished = false;

        const timeout = setTimeout(() => {
            finish(
                new Error(
                    'Permintaan ke server melewati batas waktu.'
                )
            );
        }, 25000);

        function finish(error, data) {
            if (finished) return;

            finished = true;

            clearTimeout(timeout);
            delete window[callbackName];
            script.remove();

            if (error) {
                reject(error);
            } else {
                resolve(data);
            }
        }

        window[callbackName] = data => finish(null, data);

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
            callback: callbackName
        });

        if (payload && Object.keys(payload).length > 0) {
            params.set('payload', JSON.stringify(payload));
        }

        script.src = API_URL + '?' + params.toString();

        document.body.appendChild(script);
    });
}

// =========================================================
// MEMUAT PRODUK
// =========================================================

async function loadProducts() {
    setNotice('Memuat produk dari YONS AGEN…');
    $('reload').disabled = true;

    try {
        const response = await apiGet('products');

        if (!response.ok) {
            throw new Error(
                response.error || 'Produk gagal dimuat.'
            );
        }

        state.products = response.products || [];

        renderCategories();
        renderProducts();

        setNotice(
            state.products.length
                ? 'Pilih produk yang ingin dipesan.'
                : 'Belum ada produk aktif dengan stok tersedia.'
        );
    } catch (error) {
        setNotice(error.message, true);
    } finally {
        $('reload').disabled = false;
    }
}

// =========================================================
// KATEGORI PRODUK
// =========================================================

function renderCategories() {
    const categoryElement = $('category');
    const previousCategory = categoryElement.value;

    const categories = [
        ...new Set(
            state.products
                .map(product => product.kategori)
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b, 'id'));

    categoryElement.innerHTML =
        '<option value="">Semua kategori</option>' +
        categories
            .map(category =>
                `<option value="${esc(category)}">` +
                `${esc(category)}</option>`
            )
            .join('');

    if (categories.includes(previousCategory)) {
        categoryElement.value = previousCategory;
    }
}

// =========================================================
// MENAMPILKAN PRODUK
// =========================================================

function renderProducts() {
    const query = $('search')
        .value
        .trim()
        .toLocaleLowerCase('id');

    const selectedCategory = $('category').value;

    const products = state.products.filter(product => {
        const matchesCategory =
            !selectedCategory ||
            product.kategori === selectedCategory;

        const searchableText = [
            product.nama,
            product.deskripsi,
            product.kategori
        ]
            .map(value => value || '')
            .join(' ')
            .toLocaleLowerCase('id');

        const matchesSearch =
            !query || searchableText.includes(query);

        return matchesCategory && matchesSearch;
    });

    const grid = $('products');

    if (!products.length) {
        grid.innerHTML =
            '<p class="muted">Produk tidak ditemukan.</p>';
        return;
    }

    grid.innerHTML = products
        .map(product => {
            const stock = Number(product.stok) || 0;

            const photo = product.foto
                ? `
                    <img
                        loading="lazy"
                        src="${esc(product.foto)}"
                        alt="${esc(product.nama)}"
                        onerror="
                            this.remove();
                            this.parentElement.innerHTML =
                                '<span class=&quot;photo-fallback&quot;>▧</span>';
                        "
                    >
                `
                : '<span class="photo-fallback">▧</span>';

            return `
                <article class="product">
                    <div class="product-photo">
                        ${photo}
                    </div>

                    <div class="product-body">
                        <span class="category">
                            ${esc(
                                product.kategori ||
                                'Produk YONS AGEN'
                            )}
                        </span>

                        <h3>${esc(product.nama)}</h3>

                        <p class="description">
                            ${esc(product.deskripsi || '')}
                        </p>

                        <div class="price">
                            ${rupiah(product.harga)}
                            <span class="muted small">
                                / ${esc(product.satuan || 'unit')}
                            </span>
                        </div>

                        <div class="stock">
                            Stok tersedia:
                            ${stock}
                            ${esc(product.satuan || 'unit')}
                        </div>

                        <div class="add-row">
                            <input
                                class="qty"
                                type="number"
                                min="1"
                                max="${stock}"
                                value="1"
                                id="qty-${esc(product.id)}"
                                aria-label="Jumlah ${esc(product.nama)}"
                                ${stock < 1 ? 'disabled' : ''}
                            >

                            <button
                                type="button"
                                class="button primary"
                                data-add="${esc(product.id)}"
                                ${stock < 1 ? 'disabled' : ''}
                            >
                                + Keranjang
                            </button>
                        </div>
                    </div>
                </article>
            `;
        })
        .join('');
}

// =========================================================
// KERANJANG BELANJA
// =========================================================

function addToCart(id) {
    const product = state.products.find(
        item => String(item.id) === String(id)
    );

    if (!product) return;

    const input = $('qty-' + id);
    const quantity = Math.floor(
        Number(input?.value) || 0
    );

    const existingItem = state.cart.find(
        item => String(item.id) === String(id)
    );

    const nextQuantity =
        quantity + (existingItem?.qty || 0);

    const stock = Number(product.stok) || 0;

    if (quantity < 1) {
        alert('Jumlah barang minimal 1.');
        return;
    }

    if (nextQuantity > stock) {
        alert(
            'Jumlah melebihi stok tersedia (' +
            stock +
            ').'
        );
        return;
    }

    if (existingItem) {
        existingItem.qty = nextQuantity;
    } else {
        state.cart.push({
            id: product.id,
            nama: product.nama,
            satuan: product.satuan,
            harga: Number(product.harga) || 0,
            qty: quantity,
            stok: stock
        });
    }

    renderCart();

    setNotice(
        product.nama + ' ditambahkan ke keranjang.'
    );
}

function renderCart() {
    const totalQuantity = state.cart.reduce(
        (sum, item) => sum + item.qty,
        0
    );

    const subtotal = state.cart.reduce(
        (sum, item) => sum + item.qty * item.harga,
        0
    );

    $('cartCount').textContent = totalQuantity;
    $('cartSummary').textContent =
        totalQuantity + ' barang';

    $('subtotal').textContent = rupiah(subtotal);

    const box = $('cartItems');

    if (!state.cart.length) {
        box.innerHTML =
            '<p class="muted">Belum ada barang di keranjang.</p>';
        return;
    }

    box.innerHTML = state.cart
        .map(item => `
            <div class="cart-line">
                <div>
                    <strong>${esc(item.nama)}</strong>

                    <small>
                        ${rupiah(item.harga)}
                        / ${esc(item.satuan || 'unit')}
                    </small>
                </div>

                <div class="cart-price">
                    <strong>
                        ${rupiah(item.qty * item.harga)}
                    </strong>
                </div>

                <div class="cart-controls">
                    <button
                        type="button"
                        class="mini"
                        data-dec="${esc(item.id)}"
                        aria-label="Kurangi"
                    >
                        −
                    </button>

                    <strong>${item.qty}</strong>

                    <button
                        type="button"
                        class="mini"
                        data-inc="${esc(item.id)}"
                        aria-label="Tambah"
                    >
                        +
                    </button>
                </div>

                <button
                    type="button"
                    class="remove"
                    data-remove="${esc(item.id)}"
                >
                    Hapus
                </button>
            </div>
        `)
        .join('');
}

function changeQty(id, delta) {
    const item = state.cart.find(
        product => String(product.id) === String(id)
    );

    if (!item) return;

    const nextQuantity = item.qty + delta;

    if (nextQuantity < 1) {
        state.cart = state.cart.filter(
            product => String(product.id) !== String(id)
        );
    } else if (nextQuantity > item.stok) {
        alert(
            'Jumlah melebihi stok tersedia (' +
            item.stok +
            ').'
        );
        return;
    } else {
        item.qty = nextQuantity;
    }

    renderCart();
}

// =========================================================
// EVENT KERANJANG DAN PRODUK
// =========================================================

$('products').addEventListener('click', event => {
    const button = event.target.closest('[data-add]');

    if (button) {
        addToCart(button.dataset.add);
    }
});

$('cartItems').addEventListener('click', event => {
    const button = event.target.closest('button');

    if (!button) return;

    if (button.dataset.inc) {
        changeQty(button.dataset.inc, 1);
    }

    if (button.dataset.dec) {
        changeQty(button.dataset.dec, -1);
    }

    if (button.dataset.remove) {
        state.cart = state.cart.filter(
            item =>
                String(item.id) !==
                String(button.dataset.remove)
        );

        renderCart();
    }
});

$('search').addEventListener('input', renderProducts);

$('category').addEventListener(
    'change',
    renderProducts
);

$('reload').addEventListener('click', loadProducts);

$('cartJump').addEventListener('click', () => {
    $('cartSection').scrollIntoView({
        behavior: 'smooth'
    });
});

// =========================================================
// LOKASI GPS
// =========================================================

$('gpsButton').addEventListener('click', () => {
    if (!navigator.geolocation) {
        $('gpsStatus').textContent =
            'GPS tidak didukung browser ini.';
        return;
    }

    $('gpsStatus').textContent =
        'Meminta izin lokasi…';

    navigator.geolocation.getCurrentPosition(
        position => {
            state.lat = position.coords.latitude;
            state.lng = position.coords.longitude;

            $('gpsStatus').textContent =
                'Lokasi berhasil diambil. ' +
                'Tetap isi alamat lengkap.';
        },

        error => {
            $('gpsStatus').textContent =
                error.code === 1
                    ? 'Izin lokasi ditolak. ' +
                      'Anda tetap bisa mengisi alamat manual.'
                    : 'Lokasi tidak tersedia. ' +
                      'Silakan isi alamat manual.';
        },

        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
        }
    );
});

// =========================================================
// KIRIM PESANAN
// =========================================================

$('orderForm').addEventListener(
    'submit',
    async event => {
        event.preventDefault();

        if (!state.cart.length) {
            alert('Keranjang masih kosong.');
            return;
        }

        const form = new FormData(event.currentTarget);

        const payload = {
            nama: String(form.get('nama') || '').trim(),
            hp: String(form.get('hp') || '').trim(),
            alamat: String(form.get('alamat') || '').trim(),
            pembayaran: String(
                form.get('pembayaran') || ''
            ),
            catatan: String(
                form.get('catatan') || ''
            ).trim(),

            lat: state.lat,
            lng: state.lng,

            items: state.cart.map(item => ({
                id: item.id,
                qty: item.qty
            }))
        };

        const subtotal = state.cart.reduce(
            (sum, item) =>
                sum + item.qty * item.harga,
            0
        );

        const confirmed = confirm(
            'Kirim pesanan dengan subtotal ' +
            rupiah(subtotal) +
            '? Ongkir akan ditentukan admin ' +
            'setelah pesanan diterima.'
        );

        if (!confirmed) return;

        const button = $('submitOrder');

        button.disabled = true;
        button.textContent = 'Mengirim pesanan…';

        try {
            const response = await apiGet(
                'submitOrder',
                payload
            );

            if (!response.ok) {
                throw new Error(
                    response.error ||
                    'Pesanan gagal dikirim.'
                );
            }

            $('successText').innerHTML =
                'Nomor pesanan: <strong>' +
                esc(response.orderId) +
                '</strong><br>' +

                'Subtotal barang: <strong>' +
                rupiah(response.subtotal) +
                '</strong><br><br>' +

                'Admin akan memeriksa stok dan ' +
                'mengonfirmasi ongkir serta total tagihan.';

            $('successModal').classList.remove('hidden');

            state.cart = [];
            renderCart();

            event.currentTarget.reset();

            state.lat = '';
            state.lng = '';

            $('gpsStatus').textContent =
                'Opsional, perlu izin lokasi dari perangkat.';

            await loadProducts();
        } catch (error) {
            alert(
                'Pesanan belum berhasil dikirim: ' +
                error.message
            );
        } finally {
            button.disabled = false;
            button.textContent = 'Kirim Pesanan';
        }
    }
);

// =========================================================
// MODAL KONFIRMASI
// =========================================================

$('closeModal').addEventListener('click', () => {
    $('successModal').classList.add('hidden');
});

// =========================================================
// INISIALISASI APLIKASI
// =========================================================

loadProducts();
renderCart();
```
