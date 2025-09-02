import KolbService from '../services/kolbService.js'
import type { HttpContext } from '@adonisjs/core/http'

export default class KolbController {
  private service = new KolbService()

  // GET /kolb/preguntas
  async listarPreguntas({ response }: HttpContext) {
    const result = await this.service.listarPreguntas()
    return response.json(result)
  }

  // POST /kolb/respuestas
  async guardarRespuestas({ request, response }: HttpContext) {
    const token = request.header('Authorization')?.replace('Bearer ', '')
    if (!token) return response.unauthorized({ error: 'Token requerido' })

    const data = request.only(['respuestas'])
    const result = await this.service.guardarRespuestas(data, token)
    return response.json(result)
  }

  // GET /kolb/resultado
  async obtenerResultado({ request, response }: HttpContext) {
    const token = request.header('Authorization')?.replace('Bearer ', '')
    if (!token) return response.unauthorized({ error: 'Token requerido' })

    const result = await this.service.obtenerResultado(token)
    return response.json(result)
  }
}
