import ResultadoEstudiante from '../models/resultado_estudiante.js'
import TestPorEstudiantes from '../models/test_ea_por_estudiante.js'
import EstilosAprendizajes from '../models/estilos_aprendizaje.js'
import PreguntaEstiloAprendizajes from '../models/pregunta_estilo_aprendizaje.js'
import jwt from 'jsonwebtoken'

const SECRET = process.env.jwt_secret || 'secret123'

export default class KolbService {
  // Listar preguntas
  async listarPreguntas() {
    try {
      const preguntas = await PreguntaEstiloAprendizajes.all()
      return preguntas
    } catch (error) {
      console.error('Error al listar preguntas:', error)
      return { error: 'No se pudieron cargar las preguntas' }
    }
  }

  // Guardar respuestas y calcular estilo de aprendizaje
  async guardarRespuestas(data: any, token: string) {
    try {
      // Validar token
      const payload: any = jwt.verify(token, SECRET)
      if (!payload || payload.rol !== 'Usuario') {
        return { error: 'No autorizado' }
      }

      // Usar el mismo campo que viene en el JWT
      const id_usuario = payload.id_usuario
      const { respuestas } = data

      // Validación fuerte de respuestas
      if (!respuestas || !Array.isArray(respuestas) || respuestas.length === 0) {
        return { error: 'Respuestas inválidas' }
      }

      const fecha = new Date().toISOString().slice(0, 10)

      const test = await TestPorEstudiantes.create({
        id_usuario,
        fecha_presentacion: fecha,
      })

      const puntajes: Record<string, number> = { EC: 0, OR: 0, CA: 0, EA: 0 }

      const mapEstilo: Record<string, string> = {
        'EXPERIENCIA CONCRETA': 'EC',
        'OBSERVACIÓN REFLEXIVA': 'OR',
        'CONCEPTUALIZACIÓN ABSTRACTA': 'CA',
        'EXPERIMENTACIÓN ACTIVA': 'EA',
      }

      for (const respuesta of respuestas) {
        const { id_pregunta, valor } = respuesta
        const pregunta = await PreguntaEstiloAprendizajes.find(id_pregunta)
        if (!pregunta) continue

        // Normalizar tipo_pregunta y evitar errores si es null
        const tipo = (pregunta.tipo_pregunta || '').toUpperCase().trim()
        const estilo = mapEstilo[tipo]

        if (estilo && typeof valor === 'number') {
          puntajes[estilo] += valor
        }

        // Guardar respuesta solo si el valor es válido
        if (valor !== undefined && typeof valor === 'number') {
          await ResultadoEstudiante.create({
            id_test_ea_por_estudiantes: test.id_test_ea_por_estudiantes,
            id_pregunta_estilo_aprendizajes: id_pregunta,
            valor: String(valor),
          })
        }
      }

      const valoresEstilos: Record<string, number> = {
        DIVERGENTE: puntajes.EC + puntajes.OR - puntajes.CA - puntajes.EA,
        CONVERGENTE: puntajes.CA + puntajes.EA - puntajes.EC - puntajes.OR,
        ACOMODADOR: puntajes.EA + puntajes.EC - puntajes.OR - puntajes.CA,
        ASIMILADOR: puntajes.OR + puntajes.CA - puntajes.EA - puntajes.EC,
      }

      let estiloDominante = ''
      let mayorValor = -Infinity

      for (const estilo in valoresEstilos) {
        if (valoresEstilos[estilo] > mayorValor) {
          mayorValor = valoresEstilos[estilo]
          estiloDominante = estilo
        }
      }

      const estiloAprendizaje = await EstilosAprendizajes.query()
        .where('estilo', estiloDominante)
        .first()

      if (!estiloAprendizaje) {
        return { error: 'No se encontró información del estilo de aprendizaje' }
      }

      test.estilo_aprendizaje = estiloAprendizaje.estilo
      test.id_estilos_aprendizajes = estiloAprendizaje.id_estilos_aprendizajes
      await test.save()

      return {
        mensaje: 'Test guardado correctamente',
        estilo_dominante: estiloAprendizaje.estilo,
        caracteristicas: estiloAprendizaje.caracteristicas,
        recomendaciones: estiloAprendizaje.recomendaciones,
      }
    } catch (error: any) {
      console.error('Error al guardar respuestas:', error)
      return { error: error.message || 'Error al procesar el test' }
    }
  }

  // Obtener el resultado más reciente del estudiante
  async obtenerResultado(token: string) {
    try {
      const payload: any = jwt.verify(token, SECRET)
      if (!payload || payload.rol !== 'Usuario') {
        return { error: 'No autorizado' }
      }

      const id_usuario = payload.id_usuario

      const test = await TestPorEstudiantes.query()
        .where('id_usuario', id_usuario)
        .orderBy('fecha_presentacion', 'desc')
        .preload('estilo')
        .preload('estudiante')
        .first()

      if (!test) {
        return { mensaje: 'No se encontró un test para este usuario' }
      }

      return {
        nombre: test.estudiante?.nombre_usuario,
        apellido: test.estudiante?.apellido,
        fecha: test.fecha_presentacion,
        estilo: test.estilo_aprendizaje,
        caracteristicas: test.estilo?.caracteristicas,
        recomendaciones: test.estilo?.recomendaciones,
      }
    } catch (error: any) {
      console.error('Error al obtener resultado:', error)
      return { error: error.message || 'Error al obtener el resultado del test' }
    }
  }
}
