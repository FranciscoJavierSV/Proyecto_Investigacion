const { createSchema } = require('graphql-yoga');
const resolvers = require('./resolvers');

const typeDefs = /* GraphQL */ `

	type Query {
		obtenerDataset(input: DatasetInput): DatasetResult
	}

	input DatasetInput {
		limit: Int = 100
		offset: Int = 0
	}

	type DatasetResult {
		tiempoMs: Float

		clientes: PaginatedClientes
		facturas: PaginatedFacturas
		datosfacturas: PaginatedDatosFacturas
		productos: PaginatedProductos
		variaciones: PaginatedVariaciones
	}

	type PaginatedClientes {
		data: [Cliente]
		total: Int
	}

	type PaginatedFacturas {
		data: [Factura]
		total: Int
	}

	type PaginatedDatosFacturas {
		data: [DatosFactura]
		total: Int
	}

	type PaginatedProductos {
		data: [Producto]
		total: Int
	}

	type PaginatedVariaciones {
		data: [Variacion]
		total: Int
	}

	# =========================
	# CLIENTES
	# =========================
	type Cliente {
		_id: ID
		id: Int
		nombre: String
		apepat: String
		apemat: String
		correo: String
		rfc: String
		tipoDePersona: Int
		tipo: Int
		_type: String
		activo: Boolean
		fechaRegistro: String
		telefonos: [JSON]
		listaPrecios: JSON
		direccionEnvio: JSON
		direccionFacturacion: JSON
		saldoAFavor: JSON
		historialListaPrecios: [JSON]
		_idSucursal: String
		_idEmpresa: String
		_idUsuario: String
		_idAccesoUsuario: String
		rutaFoto: String
		nombreFoto: String
	}

	# =========================
	# FACTURAS
	# =========================
	type Factura {
		_id: ID
		id: Int
		_idCliente: String
		fecha: String
		activo: Boolean
		subtotal: Float
		descuento: Float
		iva: Float
		total: Float
		observaciones: String
		_idSucursal: String
		_idEmpresa: String
		_idUsuario: String
		_idAccesoUsuario: String
		formaDePago: String
		moneda: String
		tipoDeComprobante: String
		usoDelCFDI: String
		metodoDePago: String
		_idArchivoFiscal: String
		serie: String
		folio: Int
		uuid: String
		version: String
		ieps: Float
		retencionIeps: Float
		tieneRetencionIeps: Boolean
		tipoDeCambio: Float
		_type: String
	}

	# =========================
	# DATOS FACTURAS
	# =========================
	type DatosFactura {
		_id: ID
		id: Int
		_idFactura: String
		claveProdServ: String
		claveUnidad: String
		total_retenciones: String
		iva_total: Float
		descuento: Float
		iva_unitario: String
		precio_total: String
		precio_unitario: String
		producto: String
		detalle: String
		cantidad_producto: Int
		por_iva_unitario: String
		ret_iva: String
		ret_isr: String
		cantidad_dcto: String
		trasladoIeps: Float
		porcentajeTrasladoIeps: Float
		tieneTrasladoIeps: Boolean
		retencionIeps: Float
		porcentajeRetencionIeps: Float
		tieneRetencionIeps: Boolean
		_idEmpresa: String
		_type: String
	}

	# =========================
	# PRODUCTOS
	# =========================
	type Producto {
		_id: ID
		id: Int
		fechaRegistro: String
		activo: Boolean
		nombre: String
		descripcion: String
		tieneVariaciones: Boolean
		incluyeIva: Boolean
		registroLote: Boolean
		controlLote: Boolean
		ingresoRapido: Boolean
		proveedores: [JSON]
		historialProveedores: [JSON]
		_idCSat_ClaveUnidad: String
		_idCSat_ClaveProdServ: String
		porcentajeIva: Float
		porcentajeIvaCosto: Float
		costoIncluyeIva: Boolean
		incluirDescuento: Boolean
		_idSucursal: String
		_idEmpresa: String
		_idUsuario: String
		_idAccesoUsuario: String
		_idMoneda: String
		_idMonedaCosto: String
		precio: Float
		costo: Float
		_type: String
	}

	# =========================
	# VARIACIONES
	# =========================
	type Variacion {
		_id: ID
		id: Int
		fechaRegistro: String
		activo: Boolean
		tieneColores: Boolean
		default: Boolean
		nombre: String
		descripcion: String
		upc: String
		colores: [JSON]
		imagenes: [JSON]
		precios: [JSON]
		especificaciones: [JSON]
		equivalencias: [JSON]
		_idProducto: String
		_idSucursal: String
		_idEmpresa: String
		_idUsuario: String
		_idAccesoUsuario: String
		_type: String
	}

	scalar JSON
`;

const schema = createSchema({
	typeDefs,
	resolvers
});

module.exports = { schema };