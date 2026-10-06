<?php
/**
 * Plugin Name: Berita Kilat Connector
 * Description: Menghubungkan app Berita Kilat: membuka kolom Yoast SEO (focus keyphrase, judul SEO, meta description, kategori utama) untuk REST API, dan menyediakan jalur login cadangan bila hosting menghapus header Authorization (umum di LiteSpeed/Hostinger).
 * Version:     1.1.1
 * Author:      Berita Kilat
 * License:     GPL-2.0-or-later
 * Requires at least: 5.6
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'BERITA_KILAT_CONNECTOR_VERSION', '1.1.1' );

/*
 * Jalur login cadangan.
 * Sebagian hosting/CDN membuang header "Authorization" sebelum sampai ke WordPress, sehingga
 * Application Password tidak terbaca. App Berita Kilat lalu mengirim kredensial yang sama
 * lewat header "X-BK-Auth" (Basic base64). Di sini header itu (atau varian Authorization yang
 * diteruskan server sebagai REDIRECT_HTTP_AUTHORIZATION) dipetakan ke PHP_AUTH_USER/PW,
 * lalu validasinya tetap dilakukan oleh mekanisme Application Passwords bawaan WordPress.
 */
add_action( 'plugins_loaded', function () {
	if ( ! empty( $_SERVER['PHP_AUTH_USER'] ) ) {
		return;
	}
	$raw = '';
	foreach ( array( 'HTTP_X_BK_AUTH', 'HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION' ) as $key ) {
		if ( ! empty( $_SERVER[ $key ] ) ) {
			$raw = $_SERVER[ $key ];
			break;
		}
	}
	if ( ! $raw || stripos( $raw, 'basic ' ) !== 0 ) {
		return;
	}
	$decoded = base64_decode( substr( $raw, 6 ), true );
	if ( ! $decoded || strpos( $decoded, ':' ) === false ) {
		return;
	}
	list( $user, $pass ) = explode( ':', $decoded, 2 );
	$_SERVER['PHP_AUTH_USER'] = $user;
	$_SERVER['PHP_AUTH_PW']   = $pass;
}, 0 );

// Izinkan header X-BK-Auth pada permintaan lintas domain (CORS) ke REST API.
add_filter( 'rest_allowed_cors_headers', function ( $headers ) {
	$headers[] = 'X-BK-Auth';
	return $headers;
} );

add_action( 'init', function () {
	// Hanya pengguna yang boleh mengedit pos INI (bukan sembarang pos) yang dapat menulis kolom ini.
	$can_edit = function ( $allowed, $meta_key, $object_id, $user_id ) {
		return $object_id ? user_can( $user_id, 'edit_post', $object_id ) : user_can( $user_id, 'edit_posts' );
	};

	$text_fields = array( '_yoast_wpseo_focuskw', '_yoast_wpseo_title', '_yoast_wpseo_metadesc' );
	foreach ( $text_fields as $key ) {
		register_post_meta( 'post', $key, array(
			'type'              => 'string',
			'single'            => true,
			'show_in_rest'      => true,
			'sanitize_callback' => 'sanitize_text_field',
			'auth_callback'     => $can_edit,
		) );
	}

	register_post_meta( 'post', '_yoast_wpseo_primary_category', array(
		'type'              => 'integer',
		'single'            => true,
		'show_in_rest'      => true,
		'sanitize_callback' => 'absint',
		'auth_callback'     => $can_edit,
	) );
} );

// Diagnostik untuk app: versi plugin dan apakah login terbaca (tanpa membocorkan data).
add_action( 'rest_api_init', function () {
	register_rest_route( 'berita-kilat/v1', '/ping', array(
		'methods'             => 'GET',
		'permission_callback' => '__return_true',
		'callback'            => function () {
			return array(
				'version'   => BERITA_KILAT_CONNECTOR_VERSION,
				'logged_in' => is_user_logged_in(),
			);
		},
	) );
} );
